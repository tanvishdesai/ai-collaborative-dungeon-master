import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireSessionMember } from "./lib/authHelpers";

export const list = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    await requireSessionMember(ctx, sessionId);
    const personas = await ctx.db
      .query("personas")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    return personas.sort((a, b) => a._creationTime - b._creationTime);
  },
});
