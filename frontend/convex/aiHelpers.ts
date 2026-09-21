import { v } from "convex/values";
import { internalQuery, QueryCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { rubricFor } from "./lib/rolePresets";

async function recentTranscript(
  ctx: QueryCtx,
  sessionId: Id<"sessions">,
  limit = 8,
): Promise<Array<{ speakerName: string; speakerRole?: string; text: string }>> {
  const entries = await ctx.db
    .query("transcript")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  return entries
    .filter((e) => e.kind !== "system")
    .sort((a, b) => a._creationTime - b._creationTime)
    .slice(-limit)
    .map((e) => ({
      speakerName: e.speakerName,
      speakerRole: e.speakerRole,
      text: e.text,
    }));
}

// Context for generating the next interviewer question / moderator prompt.
export const getQuestionContext = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;
    const state = await ctx.db
      .query("sessionState")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (!state || !state.currentPersonaId) return null;
    const persona = await ctx.db.get(state.currentPersonaId);
    if (!persona) return null;

    const rubric = rubricFor(session.mode);
    const targetCompetency =
      rubric.find((c) => !state.askedCompetencies.includes(c)) ??
      rubric[state.questionIndex % rubric.length] ??
      "Communication";

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();

    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();

    const candidateParticipant = participants.find((p) => p.seat === "candidate");
    const candidateProfile = candidateParticipant
      ? profiles.find((p) => p.userId === candidateParticipant.userId)
      : undefined;

    const candidate = candidateProfile
      ? {
          displayName: candidateProfile.displayName,
          targetRole: candidateProfile.targetRole,
          experienceLevel: candidateProfile.experienceLevel,
          background: candidateProfile.background,
          resumeText: candidateProfile.resumeText,
        }
      : null;

    const discussants = profiles
      .filter((p) =>
        participants.some((pp) => pp.userId === p.userId && pp.seat === "discussant"),
      )
      .map((p) => p.displayName);

    let personaMemory: Array<{ question: string; answer: string }> = [];
    if (candidate) {
      const mems = await ctx.db
        .query("personaMemories")
        .withIndex("by_persona_and_participant", (q) =>
          q.eq("personaId", persona._id).eq("participantName", candidate.displayName),
        )
        .collect();
      personaMemory = mems
        .sort((a, b) => a._creationTime - b._creationTime)
        .slice(-5)
        .map((m) => ({ question: m.question, answer: m.answer }));
    }

    return {
      mode: session.mode,
      personaId: persona._id,
      persona: {
        name: persona.name,
        personaRole: persona.personaRole,
        personality: persona.personality,
        focusAreas: persona.focusAreas,
        strictness: persona.strictness,
      },
      session: {
        targetRole: session.targetRole,
        difficulty: session.difficulty,
        topic: session.topic,
      },
      state: {
        questionIndex: state.questionIndex,
        totalQuestions: state.totalQuestions,
        difficultyLevel: state.difficultyLevel,
      },
      targetCompetency,
      candidate,
      discussants,
      recentTranscript: await recentTranscript(ctx, sessionId),
      personaMemory,
    };
  },
});

// Context for generating the end-of-session feedback report(s).
export const getFeedbackContext = internalQuery({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) return null;

    const rubric = rubricFor(session.mode);
    const state = await ctx.db
      .query("sessionState")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
    const askedCovered = state
      ? rubric.filter((c) => state.askedCompetencies.includes(c)).length
      : 0;

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    const scoredSeat = session.mode === "panel_interview" ? "candidate" : "discussant";
    const scored = participants.filter((p) => p.seat === scoredSeat);

    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();

    const responses = await ctx.db
      .query("responses")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();

    const people = scored.map((p) => {
      const profile = profiles.find((pr) => pr.userId === p.userId);
      const mine = responses
        .filter((r) => r.userId === p.userId)
        .sort((a, b) => a._creationTime - b._creationTime);
      return {
        userId: p.userId,
        participantName: profile?.displayName ?? "Participant",
        exchanges: mine.map((r) => ({ prompt: r.questionText, answer: r.answerText })),
      };
    });

    return {
      mode: session.mode,
      session: { targetRole: session.targetRole, topic: session.topic },
      competencies: rubric,
      competenciesCovered: session.mode === "panel_interview" ? askedCovered : rubric.length,
      people,
    };
  },
});
