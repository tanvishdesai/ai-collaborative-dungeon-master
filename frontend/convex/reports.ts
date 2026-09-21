import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireSessionMember } from "./lib/authHelpers";

// All feedback reports for a session (one per scored participant).
export const list = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    await requireSessionMember(ctx, sessionId);
    return await ctx.db
      .query("feedbackReports")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
  },
});

// The current user's own report, if it exists yet.
export const mine = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const { user } = await requireSessionMember(ctx, sessionId);
    return await ctx.db
      .query("feedbackReports")
      .withIndex("by_session_and_user", (q) =>
        q.eq("sessionId", sessionId).eq("userId", user._id),
      )
      .unique();
  },
});
