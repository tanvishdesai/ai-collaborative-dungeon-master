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

export async function requireRoomPlayer(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
) {
  const user = await requireUser(ctx);
  const room = await ctx.db.get(roomId);
  if (!room) throw new ConvexError("Room not found.");

  const membership = await ctx.db
    .query("roomPlayers")
    .withIndex("by_room_and_user", (q) =>
      q.eq("roomId", roomId).eq("userId", user._id),
    )
    .unique();

  if (!membership) {
    throw new ConvexError("You are not a player in this room.");
  }

  return { user, room, membership };
}

export async function requireRoomByCode(
  ctx: QueryCtx | MutationCtx,
  code: string,
) {
  const user = await requireUser(ctx);
  const normalizedCode = code.trim().toUpperCase();
  const room = await ctx.db
    .query("rooms")
    .withIndex("by_code", (q) => q.eq("code", normalizedCode))
    .unique();

  if (!room) throw new ConvexError("Room not found.");

  const membership = await ctx.db
    .query("roomPlayers")
    .withIndex("by_room_and_user", (q) =>
      q.eq("roomId", room._id).eq("userId", user._id),
    )
    .unique();

  if (!membership) {
    throw new ConvexError("You are not a player in this room.");
  }

  return { user, room, membership };
}

export type AuthUser = Doc<"users">;
