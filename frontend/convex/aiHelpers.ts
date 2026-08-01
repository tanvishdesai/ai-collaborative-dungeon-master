import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getNarrationContext = internalQuery({
  args: { roomId: v.id("rooms"), userId: v.id("users") },
  handler: async (ctx, { roomId, userId }) => {
    const gameState = await ctx.db
      .query("gameStates")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .unique();

    const playerActions = await ctx.db
      .query("playerActions")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const lastAction = playerActions.sort(
      (a, b) => b._creationTime - a._creationTime,
    )[0];

    if (!gameState || !lastAction) return null;

    const characters = await ctx.db
      .query("characters")
      .withIndex("by_room_and_user", (q) => q.eq("roomId", roomId))
      .collect();

    const playersList = characters.map((c) => ({
      name: c.characterName,
      class: c.characterClass,
      level: c.level,
      hp: c.currentHealth,
      maxHp: c.health,
      mana: c.currentMana,
      maxMana: c.mana,
    }));

    const actingCharacter = characters.find((c) => c.userId === userId);

    const gameEvents = await ctx.db
      .query("gameEvents")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const recentEvents = gameEvents
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 10)
      .map((ev) => ({ eventType: ev.eventType, details: ev.details }));

    const storyEntries = await ctx.db
      .query("storyHistory")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .collect();
    const storyHistory = storyEntries
      .sort((a, b) => a._creationTime - b._creationTime)
      .slice(-15)
      .map((s) => s.entryText);

    const recentEventsObjs = gameEvents.sort(
      (a, b) => b._creationTime - a._creationTime,
    );

    return {
      gameState,
      lastAction,
      playersList,
      actingCharacterName: actingCharacter?.characterName ?? "A player",
      recentEvents,
      storyHistory,
      recentEventsObjs,
    };
  },
});

export const persistNarration = internalMutation({
  args: { roomId: v.id("rooms"), entryText: v.string() },
  handler: async (ctx, { roomId, entryText }) => {
    await ctx.db.insert("storyHistory", { roomId, entryText });
  },
});

export const getNpcTalkContext = internalQuery({
  args: {
    roomId: v.id("rooms"),
    npcId: v.id("npcs"),
    userId: v.id("users"),
    message: v.string(),
  },
  handler: async (ctx, { roomId, npcId, userId, message }) => {
    const npc = await ctx.db.get(npcId);
    if (!npc || npc.roomId !== roomId) return null;

    const character = await ctx.db
      .query("characters")
      .withIndex("by_room_and_user", (q) =>
        q.eq("roomId", roomId).eq("userId", userId),
      )
      .unique();

    if (!character) return null;

    const charName = character.characterName;
    const currentRelationship = npc.relationships[charName] ?? 50;

    const memories = await ctx.db
      .query("npcMemories")
      .withIndex("by_npc_and_character", (q) =>
        q.eq("npcId", npcId).eq("characterName", charName),
      )
      .collect();

    const recentMemories = memories
      .sort((a, b) => a._creationTime - b._creationTime)
      .slice(-10);

    return {
      npc,
      character,
      charName,
      currentRelationship,
      recentMemories,
      message,
      roomId,
    };
  },
});

export const persistNpcTalk = internalMutation({
  args: {
    npcId: v.id("npcs"),
    roomId: v.id("rooms"),
    characterName: v.string(),
    playerMessage: v.string(),
    npcResponse: v.string(),
    rumor: v.optional(v.string()),
    newRelationship: v.number(),
    newMood: v.string(),
    relationships: v.record(v.string(), v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.npcId, {
      mood: args.newMood,
      relationships: args.relationships,
    });

    await ctx.db.insert("npcMemories", {
      npcId: args.npcId,
      characterName: args.characterName,
      playerMessage: args.playerMessage,
      npcResponse: args.npcResponse,
      rumor: args.rumor || undefined,
    });

    const npc = await ctx.db.get(args.npcId);
    const storySummary = `${args.characterName} talked to NPC ${npc!.name}. Dialogue: "${args.npcResponse}". (Mood: ${args.newMood}, Relationship: ${args.newRelationship}/100)`;

    await ctx.db.insert("storyHistory", {
      roomId: args.roomId,
      entryText: storySummary,
    });
  },
});

export const getAuthenticatedUserId = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await getAuthUserId(ctx);
  },
});
