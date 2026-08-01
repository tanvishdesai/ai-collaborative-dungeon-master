import { query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireRoomPlayer } from "./lib/authHelpers";

export const list = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    await requireRoomPlayer(ctx, roomId);

    const npcs = await ctx.db
      .query("npcs")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();

    return npcs.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { npcId: v.id("npcs") },
  handler: async (ctx, { npcId }) => {
    const npc = await ctx.db.get(npcId);
    if (!npc) throw new ConvexError("NPC not found.");

    await requireRoomPlayer(ctx, npc.roomId);

    const memories = await ctx.db
      .query("npcMemories")
      .withIndex("by_npc", (q) => q.eq("npcId", npcId))
      .collect();

    const sorted = memories.sort((a, b) => a._creationTime - b._creationTime);
    const last20 = sorted.slice(-20);

    return { ...npc, memories: last20 };
  },
});
