import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export async function deleteRoomCascade(
  ctx: MutationCtx,
  roomId: Id<"rooms">,
) {
  const npcs = await ctx.db
    .query("npcs")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();

  for (const npc of npcs) {
    const memories = await ctx.db
      .query("npcMemories")
      .withIndex("by_npc", (q) => q.eq("npcId", npc._id))
      .collect();
    for (const memory of memories) {
      await ctx.db.delete(memory._id);
    }
    await ctx.db.delete(npc._id);
  }

  const locations = await ctx.db
    .query("locations")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();

  for (const location of locations) {
    const buildings = await ctx.db
      .query("buildings")
      .withIndex("by_location", (q) => q.eq("locationId", location._id))
      .collect();
    for (const building of buildings) {
      await ctx.db.delete(building._id);
    }

    const worldObjects = await ctx.db
      .query("worldObjects")
      .withIndex("by_location", (q) => q.eq("locationId", location._id))
      .collect();
    for (const obj of worldObjects) {
      await ctx.db.delete(obj._id);
    }

    await ctx.db.delete(location._id);
  }

  const regions = await ctx.db
    .query("regions")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  for (const region of regions) {
    await ctx.db.delete(region._id);
  }

  const roomPlayers = await ctx.db
    .query("roomPlayers")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  for (const player of roomPlayers) {
    await ctx.db.delete(player._id);
  }

  const characters = await ctx.db
    .query("characters")
    .filter((q) => q.eq(q.field("roomId"), roomId))
    .collect();
  for (const character of characters) {
    await ctx.db.delete(character._id);
  }

  const gameStates = await ctx.db
    .query("gameStates")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  for (const state of gameStates) {
    await ctx.db.delete(state._id);
  }

  const gameEvents = await ctx.db
    .query("gameEvents")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  for (const event of gameEvents) {
    await ctx.db.delete(event._id);
  }

  const playerActions = await ctx.db
    .query("playerActions")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  for (const action of playerActions) {
    await ctx.db.delete(action._id);
  }

  const storyEntries = await ctx.db
    .query("storyHistory")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
  for (const entry of storyEntries) {
    await ctx.db.delete(entry._id);
  }

  await ctx.db.delete(roomId);
}
