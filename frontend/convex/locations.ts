import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireRoomPlayer } from "./lib/authHelpers";

export const listConnected = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    await requireRoomPlayer(ctx, roomId);

    const gameState = await ctx.db
      .query("gameStates")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .unique();

    if (!gameState?.currentLocationId) return [];

    const currentLoc = await ctx.db.get(gameState.currentLocationId);
    if (!currentLoc) return [];

    const connected = await Promise.all(
      currentLoc.connectedLocations.map(async (locId) => {
        const loc = await ctx.db.get(locId);
        return loc ? { id: loc._id, name: loc.name } : null;
      }),
    );

    return connected.filter(
      (entry): entry is { id: typeof currentLoc._id; name: string } =>
        entry !== null,
    );
  },
});
