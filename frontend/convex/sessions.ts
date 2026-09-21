import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requireUser, requireSessionByCode } from "./lib/authHelpers";
import { deleteSessionCascade } from "./lib/cascadeDelete";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const MAX_CODE_ATTEMPTS = 10;
const MAX_PARTICIPANTS = 8;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function buildSessionPayload(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<"sessions">,
  currentUserId: Id<"users">,
) {
  const session = (await ctx.db.get(sessionId))!;
  const host = await ctx.db.get(session.hostUserId);

  const participants = await ctx.db
    .query("participants")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();

  const players = await Promise.all(
    participants.map(async (p) => {
      const user = await ctx.db.get(p.userId);
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_session_and_user", (q) =>
          q.eq("sessionId", sessionId).eq("userId", p.userId),
        )
        .unique();
      return {
        ...p,
        user: user
          ? { id: user._id, username: user.username ?? "", email: user.email ?? "" }
          : null,
        profile,
      };
    }),
  );

  const membership = participants.find((p) => p.userId === currentUserId);

  return {
    session,
    host: host
      ? { id: host._id, username: host.username ?? "", email: host.email ?? "" }
      : null,
    players,
    currentUserRole: membership?.role ?? null,
    currentUserSeat: membership?.seat ?? null,
  };
}

export const create = mutation({
  args: {
    mode: v.union(
      v.literal("panel_interview"),
      v.literal("group_discussion"),
    ),
    targetRole: v.string(),
    topic: v.string(),
    difficulty: v.union(
      v.literal("easy"),
      v.literal("medium"),
      v.literal("hard"),
    ),
    questionCount: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const questionCount = Math.max(3, Math.min(12, Math.round(args.questionCount)));

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateCode();
      const existing = await ctx.db
        .query("sessions")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();
      if (existing) continue;

      const sessionId = await ctx.db.insert("sessions", {
        code,
        hostUserId: user._id,
        status: "waiting",
        mode: args.mode,
        targetRole: args.targetRole,
        topic: args.topic,
        difficulty: args.difficulty,
        questionCount,
      });

      await ctx.db.insert("participants", {
        sessionId,
        userId: user._id,
        role: "HOST",
        // In an interview the host is the candidate; in a GD, a discussant.
        seat: args.mode === "panel_interview" ? "candidate" : "discussant",
        isConnected: true,
        isReady: false,
      });

      return await buildSessionPayload(ctx, sessionId, user._id);
    }

    throw new ConvexError("Could not generate a unique session code. Try again.");
  },
});

export const join = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const user = await requireUser(ctx);
    const normalized = code.trim().toUpperCase();

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_code", (q) => q.eq("code", normalized))
      .unique();

    if (!session) throw new ConvexError("Session not found.");
    if (session.status !== "waiting") {
      throw new ConvexError("This session has already started.");
    }

    const existing = await ctx.db
      .query("participants")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", session._id).eq("userId", user._id),
      )
      .unique();
    if (existing) throw new ConvexError("You have already joined this session.");

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();
    if (participants.length >= MAX_PARTICIPANTS) {
      throw new ConvexError("Session is full.");
    }

    await ctx.db.insert("participants", {
      sessionId: session._id,
      userId: user._id,
      role: "MEMBER",
      // A GD needs many active voices; an interview has one candidate + observers.
      seat: session.mode === "group_discussion" ? "discussant" : "observer",
      isConnected: true,
      isReady: false,
    });

    return await buildSessionPayload(ctx, session._id, user._id);
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { user, session } = await requireSessionByCode(ctx, code);
    return await buildSessionPayload(ctx, session._id, user._id);
  },
});

export const toggleReady = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { user, session, membership } = await requireSessionByCode(ctx, code);
    const newReady = !membership.isReady;
    await ctx.db.patch(membership._id, { isReady: newReady });

    const profile = await ctx.db
      .query("profiles")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", session._id).eq("userId", user._id),
      )
      .unique();
    if (profile) await ctx.db.patch(profile._id, { ready: newReady });

    return await buildSessionPayload(ctx, session._id, user._id);
  },
});

export const start = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { user, session } = await requireSessionByCode(ctx, code);
    if (session.hostUserId !== user._id) {
      throw new ConvexError("Only the host can start the session.");
    }

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();

    // Everyone who is scored (candidate/discussant) needs a profile and readiness.
    for (const p of participants) {
      const pUser = await ctx.db.get(p.userId);
      const name = pUser?.username ?? "A participant";
      const profile = await ctx.db
        .query("profiles")
        .withIndex("by_session_and_user", (q) =>
          q.eq("sessionId", session._id).eq("userId", p.userId),
        )
        .unique();
      if (!profile) throw new ConvexError(`'${name}' has not set up a profile.`);
      if (p.role !== "HOST" && !p.isReady) {
        throw new ConvexError(`'${name}' is not ready yet.`);
      }
    }

    if (session.mode === "group_discussion") {
      const discussants = participants.filter((p) => p.seat === "discussant");
      if (discussants.length < 2) {
        throw new ConvexError(
          "A group discussion needs at least 2 participants.",
        );
      }
    }

    await ctx.db.patch(session._id, { status: "active" });

    const personaIds = await ctx.runMutation(
      internal.scenarioSeeder.seedPersonas,
      { sessionId: session._id },
    );
    const firstPersonaId = personaIds[0];
    if (!firstPersonaId) throw new ConvexError("Failed to set up the AI panel.");

    await ctx.runMutation(internal.sessionEngine.initializeSession, {
      sessionId: session._id,
      firstPersonaId,
    });

    // Kick off the first question / topic prompt.
    await ctx.scheduler.runAfter(0, internal.ai.generateQuestion, {
      sessionId: session._id,
    });

    return await buildSessionPayload(ctx, session._id, user._id);
  },
});

export const kickPlayer = mutation({
  args: { code: v.string(), username: v.string() },
  handler: async (ctx, { code, username }) => {
    const { user, session } = await requireSessionByCode(ctx, code);
    if (session.hostUserId !== user._id) {
      throw new ConvexError("Only the host can remove participants.");
    }

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();

    let target = null;
    for (const p of participants) {
      const pUser = await ctx.db.get(p.userId);
      if (pUser?.username === username) {
        target = p;
        break;
      }
    }
    if (!target) throw new ConvexError("Participant not found.");
    if (target.userId === session.hostUserId) {
      throw new ConvexError("Cannot remove the host.");
    }

    await ctx.db.delete(target._id);
    return {
      ...(await buildSessionPayload(ctx, session._id, user._id)),
      kickedUsername: username,
    };
  },
});

export const transferHost = mutation({
  args: { code: v.string(), username: v.string() },
  handler: async (ctx, { code, username }) => {
    const { user, session } = await requireSessionByCode(ctx, code);
    if (session.hostUserId !== user._id) {
      throw new ConvexError("Only the host can transfer hosting rights.");
    }

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_session", (q) => q.eq("sessionId", session._id))
      .collect();

    let target = null;
    let hostPlayer = null;
    for (const p of participants) {
      const pUser = await ctx.db.get(p.userId);
      if (pUser?.username === username) target = p;
      if (p.userId === user._id) hostPlayer = p;
    }
    if (!target) throw new ConvexError("Target participant not found.");

    await ctx.db.patch(session._id, { hostUserId: target.userId });
    if (hostPlayer) await ctx.db.patch(hostPlayer._id, { role: "MEMBER" });
    await ctx.db.patch(target._id, { role: "HOST" });

    return await buildSessionPayload(ctx, session._id, user._id);
  },
});

export const deleteSession = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { user, session } = await requireSessionByCode(ctx, code);
    if (session.hostUserId !== user._id) {
      throw new ConvexError("Only the host can delete the session.");
    }
    await deleteSessionCascade(ctx, session._id);
    return { deleted: true };
  },
});

export const leave = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { user, session, membership } = await requireSessionByCode(ctx, code);
    if (session.hostUserId === user._id) {
      await deleteSessionCascade(ctx, session._id);
      return { sessionDeleted: true };
    }
    await ctx.db.delete(membership._id);
    return { sessionDeleted: false };
  },
});
