import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { QueryCtx, MutationCtx } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

export async function requireUser(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Not authenticated.");
  const user = await ctx.db.get(userId);
  if (!user || user.isActive === false) {
    throw new ConvexError("This account has been disabled.");
  }
  if (!user.username) {
    throw new ConvexError("Account profile incomplete. Please sign up again.");
  }
  return user;
}

export async function requireSessionMember(
  ctx: QueryCtx | MutationCtx,
  sessionId: Id<"sessions">,
) {
  const user = await requireUser(ctx);
  const session = await ctx.db.get(sessionId);
  if (!session) throw new ConvexError("Session not found.");

  const membership = await ctx.db
    .query("participants")
    .withIndex("by_session_and_user", (q) =>
      q.eq("sessionId", sessionId).eq("userId", user._id),
    )
    .unique();

  if (!membership) {
    throw new ConvexError("You are not a participant in this session.");
  }

  return { user, session, membership };
}

export async function requireSessionByCode(
  ctx: QueryCtx | MutationCtx,
  code: string,
) {
  const user = await requireUser(ctx);
  const normalizedCode = code.trim().toUpperCase();
  const session = await ctx.db
    .query("sessions")
    .withIndex("by_code", (q) => q.eq("code", normalizedCode))
    .unique();

  if (!session) throw new ConvexError("Session not found.");

  const membership = await ctx.db
    .query("participants")
    .withIndex("by_session_and_user", (q) =>
      q.eq("sessionId", session._id).eq("userId", user._id),
    )
    .unique();

  if (!membership) {
    throw new ConvexError("You are not a participant in this session.");
  }

  return { user, session, membership };
}

export type AuthUser = Doc<"users">;
