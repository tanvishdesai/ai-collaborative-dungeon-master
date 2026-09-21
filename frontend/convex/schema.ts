import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const competencyScore = v.object({
  name: v.string(),
  score: v.number(), // 1-5
  justification: v.string(),
});

export default defineSchema({
  ...authTables,

  users: defineTable({
    ...authTables.users.validator.fields,
    username: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("by_username", ["username"]),

  // A practice session: a panel interview or a group discussion.
  sessions: defineTable({
    code: v.string(),
    hostUserId: v.id("users"),
    status: v.union(
      v.literal("waiting"),
      v.literal("active"),
      v.literal("completed"),
    ),
    mode: v.union(
      v.literal("panel_interview"),
      v.literal("group_discussion"),
    ),
    targetRole: v.string(),
    topic: v.string(), // GD topic, or interview focus note
    difficulty: v.union(
      v.literal("easy"),
      v.literal("medium"),
      v.literal("hard"),
    ),
    questionCount: v.number(), // interview: # of questions; GD: # of rounds
  }).index("by_code", ["code"]),

  participants: defineTable({
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    role: v.union(v.literal("HOST"), v.literal("MEMBER")),
    seat: v.union(
      v.literal("candidate"), // interview: the person being interviewed
      v.literal("discussant"), // GD: an active participant
      v.literal("observer"), // watches live, not scored
    ),
    isConnected: v.boolean(),
    isReady: v.boolean(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_and_user", ["sessionId", "userId"]),

  profiles: defineTable({
    userId: v.id("users"),
    sessionId: v.id("sessions"),
    displayName: v.string(),
    targetRole: v.string(),
    experienceLevel: v.string(),
    background: v.string(), // short "resume summary" the interviewer can use
    resumeText: v.optional(v.string()), // full résumé text (from an uploaded file) the interviewer grounds questions in
    avatar: v.string(),
    ready: v.boolean(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_and_user", ["sessionId", "userId"])
    .index("by_session_and_name", ["sessionId", "displayName"]),

  // AI interviewer / moderator personas seeded per session.
  personas: defineTable({
    sessionId: v.id("sessions"),
    name: v.string(),
    personaRole: v.string(),
    personality: v.string(),
    focusAreas: v.string(),
    strictness: v.number(),
    avatar: v.string(),
    mood: v.string(),
    goals: v.string(),
  }).index("by_session", ["sessionId"]),

  // Per-participant memory: lets an interviewer reference & probe earlier answers.
  personaMemories: defineTable({
    personaId: v.id("personas"),
    participantName: v.string(),
    question: v.string(),
    answer: v.string(),
  })
    .index("by_persona", ["personaId"])
    .index("by_persona_and_participant", ["personaId", "participantName"]),

  sessionState: defineTable({
    sessionId: v.id("sessions"),
    phase: v.union(
      v.literal("awaiting_answer"), // waiting for the human to respond
      v.literal("generating"), // AI is producing the next question/prompt
      v.literal("complete"), // session over, report(s) available
    ),
    currentPersonaId: v.optional(v.id("personas")),
    currentQuestion: v.string(),
    currentSpeakerName: v.optional(v.string()), // whom the panel addressed / GD nudge
    questionIndex: v.number(),
    totalQuestions: v.number(),
    difficultyLevel: v.number(), // escalates 1..3 across the session
    askedCompetencies: v.array(v.string()), // coverage tracking (Tier-B metric)
    turnIndex: v.number(),
  }).index("by_session", ["sessionId"]),

  transcript: defineTable({
    sessionId: v.id("sessions"),
    kind: v.union(
      v.literal("question"),
      v.literal("answer"),
      v.literal("system"),
      v.literal("moderator"),
    ),
    speakerName: v.string(),
    speakerRole: v.optional(v.string()),
    text: v.string(),
    competency: v.optional(v.string()),
  }).index("by_session", ["sessionId"]),

  responses: defineTable({
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    participantName: v.string(),
    questionText: v.string(),
    answerText: v.string(),
    wordCount: v.number(),
  }).index("by_session", ["sessionId"]),

  feedbackReports: defineTable({
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    participantName: v.string(),
    overallScore: v.number(), // 0-100
    competencies: v.array(competencyScore),
    strengths: v.array(v.string()),
    improvements: v.array(v.string()),
    summary: v.string(),
    // Deterministic (Tier-B) metrics computed by the engine, not the LLM.
    metrics: v.object({
      questionsAnswered: v.number(),
      competenciesCovered: v.number(),
      totalCompetencies: v.number(),
      avgAnswerWords: v.number(),
    }),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_and_user", ["sessionId", "userId"]),
});
