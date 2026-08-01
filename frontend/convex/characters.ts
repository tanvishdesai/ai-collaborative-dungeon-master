import { mutation, query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireRoomByCode, requireRoomPlayer } from "./lib/authHelpers";
import {
  CLASS_STARTING_STATS,
  CharacterClass,
} from "./lib/classPresets";

export const create = mutation({
  args: {
    roomCode: v.string(),
    characterName: v.string(),
    characterClass: v.union(
      v.literal("Warrior"),
      v.literal("Mage"),
      v.literal("Archer"),
      v.literal("Rogue"),
      v.literal("Healer"),
    ),
    avatar: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, room } = await requireRoomByCode(ctx, args.roomCode);

    const existing = await ctx.db
      .query("characters")
      .withIndex("by_room_and_user", (q) =>
        q.eq("roomId", room._id).eq("userId", user._id),
      )
      .unique();

    if (existing) {
      throw new ConvexError("You have already created a character in this room.");
    }

    const cleanedName = args.characterName.trim();
    if (!cleanedName) {
      throw new ConvexError("Character name is required.");
    }

    const nameTaken = await ctx.db
      .query("characters")
      .withIndex("by_room_and_name", (q) =>
        q.eq("roomId", room._id).eq("characterName", cleanedName),
      )
      .unique();

    if (nameTaken) {
      throw new ConvexError("Character name is already taken in this room.");
    }

    const stats = CLASS_STARTING_STATS[args.characterClass as CharacterClass];
    if (!stats) {
      throw new ConvexError(`Invalid class: ${args.characterClass}`);
    }

    const characterId = await ctx.db.insert("characters", {
      userId: user._id,
      roomId: room._id,
      characterName: cleanedName,
      characterClass: args.characterClass,
      avatar: args.avatar,
      level: 1,
      experience: 0,
      health: stats.health,
      mana: stats.mana,
      strength: stats.strength,
      intelligence: stats.intelligence,
      agility: stats.agility,
      defense: stats.defense,
      luck: stats.luck,
      currentHealth: stats.health,
      currentMana: stats.mana,
      gold: stats.gold,
      readyForGame: false,
    });

    return await ctx.db.get(characterId);
  },
});

export const getMine = query({
  args: {
    roomId: v.optional(v.id("rooms")),
    roomCode: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let roomId = args.roomId;

    if (!roomId) {
      if (!args.roomCode) return null;
      const { user, room } = await requireRoomByCode(ctx, args.roomCode);
      roomId = room._id;
      const character = await ctx.db
        .query("characters")
        .withIndex("by_room_and_user", (q) =>
          q.eq("roomId", roomId!).eq("userId", user._id),
        )
        .unique();
      return character;
    }

    const { user } = await requireRoomPlayer(ctx, roomId);
    return await ctx.db
      .query("characters")
      .withIndex("by_room_and_user", (q) =>
        q.eq("roomId", roomId!).eq("userId", user._id),
      )
      .unique();
  },
});