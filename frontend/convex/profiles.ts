import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireSessionByCode, requireSessionMember } from "./lib/authHelpers";

export const create = mutation({
  args: {
    sessionCode: v.string(),
    displayName: v.string(),
    targetRole: v.string(),
    experienceLevel: v.string(),
    background: v.string(),
    avatar: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, session } = await requireSessionByCode(ctx, args.sessionCode);

    const existing = await ctx.db
      .query("profiles")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", session._id).eq("userId", user._id),
      )
      .unique();
    if (existing) {
      throw new ConvexError("You already have a profile in this session.");
    }

    const name = args.displayName.trim();
    if (!name) throw new ConvexError("Display name is required.");

    const taken = await ctx.db
      .query("profiles")
      .withIndex("by_session_and_name", (q) =>
        q.eq("sessionId", session._id).eq("displayName", name),
      )
      .unique();
    if (taken) throw new ConvexError("That name is already taken in this session.");

    const profileId = await ctx.db.insert("profiles", {
      userId: user._id,
      sessionId: session._id,
      displayName: name,
      targetRole: args.targetRole,
      experienceLevel: args.experienceLevel,
      background: args.background.trim(),
      avatar: args.avatar,
      ready: false,
    });

    return await ctx.db.get(profileId);
  },
});

export const getMine = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const { user } = await requireSessionMember(ctx, sessionId);
    return await ctx.db
      .query("profiles")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", user._id),
      )
      .unique();
  },
});
