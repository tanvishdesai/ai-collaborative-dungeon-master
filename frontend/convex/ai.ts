"use node";

import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  renderInterviewerPrompt,
  renderModeratorPrompt,
  renderFeedbackPrompt,
} from "./promptBuilder";
import { generateJson } from "./aiProviders";

const questionSchema = {
  type: "object",
  properties: {
    reaction: { type: "string" },
    question: { type: "string" },
  },
  required: ["question"],
};

const feedbackSchema = {
  type: "object",
  properties: {
    overallScore: { type: "number" },
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvements: { type: "array", items: { type: "string" } },
    competencies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          score: { type: "number" },
          justification: { type: "string" },
        },
        required: ["name", "score", "justification"],
      },
    },
  },
  required: ["overallScore", "summary", "competencies"],
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : lo));

export const generateQuestion = internalAction({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const c = await ctx.runQuery(internal.aiHelpers.getQuestionContext, { sessionId });
    if (!c) return;

    let promptText: string;
    if (c.mode === "group_discussion") {
      promptText = renderModeratorPrompt({
        topic: c.session.topic,
        round: c.state.questionIndex,
        totalRounds: c.state.totalQuestions,
        discussants: c.discussants,
        recentTranscript: c.recentTranscript,
      });
    } else {
      promptText = renderInterviewerPrompt({
        persona: c.persona,
        candidate:
          c.candidate ?? {
            displayName: "the candidate",
            targetRole: c.session.targetRole,
            experienceLevel: "Fresher",
            background: "",
          },
        session: { targetRole: c.session.targetRole, difficulty: c.session.difficulty },
        targetCompetency: c.targetCompetency,
        difficultyLevel: c.state.difficultyLevel,
        questionIndex: c.state.questionIndex,
        totalQuestions: c.state.totalQuestions,
        recentTranscript: c.recentTranscript,
        personaMemory: c.personaMemory,
      });
    }

    let reaction = "";
    let question =
      c.mode === "group_discussion"
        ? `Let's continue our discussion on "${c.session.topic}". Who would like to add a new perspective?`
        : "Tell me about yourself and why you're interested in this role.";

    try {
      const parsed = (await generateJson(promptText, 0.7, questionSchema)) as {
        question?: string;
        reaction?: string;
      };
      if (parsed.question?.trim()) question = parsed.question.trim();
      if (parsed.reaction?.trim()) reaction = parsed.reaction.trim();
    } catch (err) {
      console.error("Question generation failed, using fallback:", err);
    }

    await ctx.runMutation(internal.sessionEngine.applyGeneratedQuestion, {
      sessionId,
      personaId: c.personaId,
      reaction,
      question,
      competency: c.targetCompetency,
      speakerName: c.candidate?.displayName,
    });
  },
});

export const generateFeedback = internalAction({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const c = await ctx.runQuery(internal.aiHelpers.getFeedbackContext, { sessionId });
    if (!c) return;

    for (const person of c.people) {
      const avgWords = person.exchanges.length
        ? Math.round(
            person.exchanges.reduce(
              (s, e) => s + e.answer.trim().split(/\s+/).filter(Boolean).length,
              0,
            ) / person.exchanges.length,
          )
        : 0;

      const metrics = {
        questionsAnswered: person.exchanges.length,
        competenciesCovered: c.competenciesCovered,
        totalCompetencies: c.competencies.length,
        avgAnswerWords: avgWords,
      };

      // No substantive answers → deterministic low report, no LLM call needed.
      if (person.exchanges.length === 0) {
        await ctx.runMutation(internal.sessionEngine.persistReport, {
          sessionId,
          userId: person.userId,
          participantName: person.participantName,
          overallScore: 0,
          competencies: c.competencies.map((name) => ({
            name,
            score: 1,
            justification: "No answer was given to assess this competency.",
          })),
          strengths: [],
          improvements: ["Attempt every question — even a brief, structured answer scores better than silence."],
          summary: `${person.participantName} did not provide answers, so there is nothing to assess. Try the session again and respond to each prompt.`,
          metrics,
        });
        continue;
      }

      const promptText = renderFeedbackPrompt({
        mode: c.mode,
        participantName: person.participantName,
        targetRole: c.session.targetRole,
        topic: c.session.topic,
        competencies: c.competencies,
        exchanges: person.exchanges,
      });

      let report = {
        overallScore: 60,
        summary: `Assessment could not be generated automatically for ${person.participantName}. Please review the transcript.`,
        strengths: [] as string[],
        improvements: [] as string[],
        competencies: c.competencies.map((name) => ({
          name,
          score: 3,
          justification: "Automatic scoring unavailable.",
        })),
      };

      try {
        const parsed = (await generateJson(promptText, 0.4, feedbackSchema)) as typeof report;
        if (parsed?.competencies?.length) report = parsed;
      } catch (err) {
        console.error("Feedback generation failed, using fallback:", err);
      }

      // Normalise into the rubric: exactly the rubric competencies, scores 1-5.
      const byName = new Map(
        (report.competencies ?? []).map((x) => [x.name, x]),
      );
      const competencies = c.competencies.map((name) => {
        const found = byName.get(name);
        return {
          name,
          score: clamp(Math.round(found?.score ?? 3), 1, 5),
          justification: found?.justification ?? "Not specifically assessed.",
        };
      });

      await ctx.runMutation(internal.sessionEngine.persistReport, {
        sessionId,
        userId: person.userId,
        participantName: person.participantName,
        overallScore: clamp(Math.round(report.overallScore), 0, 100),
        competencies,
        strengths: (report.strengths ?? []).slice(0, 5),
        improvements: (report.improvements ?? []).slice(0, 5),
        summary: report.summary ?? "",
        metrics,
      });
    }

    await ctx.runMutation(internal.sessionEngine.finalizeSession, { sessionId });
  },
});
