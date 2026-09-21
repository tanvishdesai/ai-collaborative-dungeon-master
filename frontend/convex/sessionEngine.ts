import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requireSessionMember } from "./lib/authHelpers";
import { DIFFICULTY_BASE, Difficulty } from "./lib/rolePresets";

function difficultyFor(session: { difficulty: string }, index: number, total: number): number {
  const base = DIFFICULTY_BASE[session.difficulty as Difficulty] ?? 2;
  const progress = total > 0 ? index / total : 0;
  return Math.min(3, base + Math.floor(progress * 2));
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const get = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    await requireSessionMember(ctx, sessionId);
    return await ctx.db
      .query("sessionState")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
  },
});

export const initializeSession = internalMutation({
  args: { sessionId: v.id("sessions"), firstPersonaId: v.id("personas") },
  handler: async (ctx, { sessionId, firstPersonaId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new ConvexError("Session not found.");

    const existing = await ctx.db
      .query("sessionState")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (existing) return existing;

    const base = DIFFICULTY_BASE[session.difficulty as Difficulty] ?? 2;

    await ctx.db.insert("sessionState", {
      sessionId,
      phase: "generating",
      currentPersonaId: firstPersonaId,
      currentQuestion: "",
      currentSpeakerName: undefined,
      questionIndex: 0,
      totalQuestions: session.questionCount,
      difficultyLevel: base,
      askedCompetencies: [],
      turnIndex: 0,
    });

    await ctx.db.insert("transcript", {
      sessionId,
      kind: "system",
      speakerName: "System",
      text:
        session.mode === "panel_interview"
          ? "The panel is ready. Your interview is beginning — answer each question as you would in a real placement interview."
          : "The moderator is opening the group discussion. Contribute clearly and let others speak too.",
    });
  },
});

// Called by the AI action once it has generated the next question / prompt.
export const applyGeneratedQuestion = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    personaId: v.id("personas"),
    reaction: v.string(),
    question: v.string(),
    competency: v.string(),
    speakerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;
    const state = await ctx.db
      .query("sessionState")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    if (!state) return;
    const persona = await ctx.db.get(args.personaId);

    const text = args.reaction.trim()
      ? `${args.reaction.trim()}\n\n${args.question.trim()}`
      : args.question.trim();

    await ctx.db.insert("transcript", {
      sessionId: args.sessionId,
      kind: session.mode === "group_discussion" ? "moderator" : "question",
      speakerName: persona?.name ?? "Interviewer",
      speakerRole: persona?.personaRole,
      text,
      competency: args.competency || undefined,
    });

    const askedCompetencies = state.askedCompetencies.includes(args.competency)
      ? state.askedCompetencies
      : [...state.askedCompetencies, args.competency].filter(Boolean);

    await ctx.db.patch(state._id, {
      currentQuestion: args.question.trim(),
      currentPersonaId: args.personaId,
      currentSpeakerName: args.speakerName,
      askedCompetencies,
      phase: "awaiting_answer",
    });
  },
});

export const submitAnswer = mutation({
  args: { sessionId: v.id("sessions"), answerText: v.string() },
  handler: async (ctx, { sessionId, answerText }) => {
    const { user, session, membership } = await requireSessionMember(ctx, sessionId);

    if (session.status !== "active") {
      throw new ConvexError("This session is not active.");
    }

    const state = await ctx.db
      .query("sessionState")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (!state) throw new ConvexError("Session has not started.");
    if (state.phase !== "awaiting_answer") {
      throw new ConvexError("Please wait — the panel is thinking.");
    }

    if (session.mode === "panel_interview" && membership.seat !== "candidate") {
      throw new ConvexError("Only the candidate answers in an interview. You are observing.");
    }
    if (session.mode === "group_discussion" && membership.seat !== "discussant") {
      throw new ConvexError("Only participants can contribute to the discussion.");
    }

    const answer = answerText.trim();
    if (!answer) throw new ConvexError("Your answer can't be empty.");

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", user._id),
      )
      .unique();
    if (!profile) throw new ConvexError("Set up your profile first.");

    const participantName = profile.displayName;

    await ctx.db.insert("transcript", {
      sessionId,
      kind: "answer",
      speakerName: participantName,
      speakerRole: membership.seat === "candidate" ? "Candidate" : "Participant",
      text: answer,
    });

    await ctx.db.insert("responses", {
      sessionId,
      userId: user._id,
      participantName,
      questionText: state.currentQuestion,
      answerText: answer,
      wordCount: wordCount(answer),
    });

    if (state.currentPersonaId) {
      await ctx.db.insert("personaMemories", {
        personaId: state.currentPersonaId,
        participantName,
        question: state.currentQuestion,
        answer,
      });
    }

    const turnIndex = state.turnIndex + 1;

    if (session.mode === "panel_interview") {
      const nextIndex = state.questionIndex + 1;
      if (nextIndex >= state.totalQuestions) {
        await ctx.db.patch(state._id, { phase: "generating", turnIndex });
        await ctx.scheduler.runAfter(0, internal.ai.generateFeedback, { sessionId });
      } else {
        const personas = await ctx.db
          .query("personas")
          .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
          .collect();
        personas.sort((a, b) => a._creationTime - b._creationTime);
        const nextPersona = personas[nextIndex % personas.length];
        await ctx.db.patch(state._id, {
          phase: "generating",
          questionIndex: nextIndex,
          currentPersonaId: nextPersona?._id,
          difficultyLevel: difficultyFor(session, nextIndex, state.totalQuestions),
          turnIndex,
        });
        await ctx.scheduler.runAfter(0, internal.ai.generateQuestion, { sessionId });
      }
      return { ok: true };
    }

    // Group discussion: a "round" completes once every discussant has spoken.
    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    const discussantCount = Math.max(
      1,
      participants.filter((p) => p.seat === "discussant").length,
    );
    const roundsCompleted = Math.floor(turnIndex / discussantCount);

    if (roundsCompleted > state.questionIndex) {
      if (roundsCompleted >= state.totalQuestions) {
        await ctx.db.patch(state._id, {
          phase: "generating",
          questionIndex: roundsCompleted,
          turnIndex,
        });
        await ctx.scheduler.runAfter(0, internal.ai.generateFeedback, { sessionId });
      } else {
        await ctx.db.patch(state._id, {
          phase: "generating",
          questionIndex: roundsCompleted,
          difficultyLevel: difficultyFor(session, roundsCompleted, state.totalQuestions),
          turnIndex,
        });
        await ctx.scheduler.runAfter(0, internal.ai.generateQuestion, { sessionId });
      }
    } else {
      // Same round — the next participant speaks; stay open for input.
      await ctx.db.patch(state._id, { turnIndex });
    }
    return { ok: true };
  },
});

// Host can end early (useful for GDs, or to cut an interview short and still
// get a report on what was answered).
export const endSession = mutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const { user, session } = await requireSessionMember(ctx, sessionId);
    if (session.hostUserId !== user._id) {
      throw new ConvexError("Only the host can end the session.");
    }
    const state = await ctx.db
      .query("sessionState")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (!state || state.phase === "complete") return { ok: true };

    await ctx.db.patch(state._id, { phase: "generating" });
    await ctx.scheduler.runAfter(0, internal.ai.generateFeedback, { sessionId });
    return { ok: true };
  },
});

export const persistReport = internalMutation({
  args: {
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    participantName: v.string(),
    overallScore: v.number(),
    competencies: v.array(
      v.object({ name: v.string(), score: v.number(), justification: v.string() }),
    ),
    strengths: v.array(v.string()),
    improvements: v.array(v.string()),
    summary: v.string(),
    metrics: v.object({
      questionsAnswered: v.number(),
      competenciesCovered: v.number(),
      totalCompetencies: v.number(),
      avgAnswerWords: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("feedbackReports")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", args.sessionId).eq("userId", args.userId),
      )
      .unique();
    if (existing) return;
    await ctx.db.insert("feedbackReports", args);
  },
});

export const finalizeSession = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const state = await ctx.db
      .query("sessionState")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .unique();
    if (state) await ctx.db.patch(state._id, { phase: "complete" });
    await ctx.db.patch(sessionId, { status: "completed" });
    await ctx.db.insert("transcript", {
      sessionId,
      kind: "system",
      speakerName: "System",
      text: "Session complete. Your feedback report is ready below.",
    });
  },
});
