import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query, internalQuery } from "./_generated/server";

export const usernameTaken = internalQuery({
  args: { username: v.string() },
  handler: async (ctx, { username }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    return existing !== null;
  },
});

export const emailTaken = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .unique();
    return existing !== null;
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      id: user._id,
      email: user.email ?? "",
      username: user.username ?? "",
      isActive: user.isActive ?? true,
    };
  },
});
