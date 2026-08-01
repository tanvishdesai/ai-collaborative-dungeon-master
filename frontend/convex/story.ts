import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireRoomPlayer } from "./lib/authHelpers";

export const list = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    await requireRoomPlayer(ctx, roomId);

    const entries = await ctx.db
      .query("storyHistory")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    return entries.sort((a, b) => a._creationTime - b._creationTime);
  },
});
