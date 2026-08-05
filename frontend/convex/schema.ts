import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const monster = v.object({
  name: v.string(),
  health: v.number(),
  maxHealth: v.number(),
  damage: v.number(),
  defense: v.number(),
  xp: v.number(),
  gold: v.number(),
});

const sceneNpc = v.object({
  name: v.string(),
  type: v.string(),
  health: v.number(),
  status: v.string(),
  dialogue: v.string(),
});

const sceneObject = v.object({
  name: v.string(),
  type: v.string(),
  status: v.string(),
  items: v.optional(v.array(v.string())),
  gold: v.optional(v.number()),
  requires: v.optional(v.string()),
  leadsTo: v.optional(v.string()),
});

export default defineSchema({
  ...authTables,

  users: defineTable({
    ...authTables.users.validator.fields,
    username: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("by_username", ["username"]),

  rooms: defineTable({
    code: v.string(),
    hostUserId: v.id("users"),
    status: v.union(v.literal("waiting"), v.literal("playing")),
  }).index("by_code", ["code"]),

  roomPlayers: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    role: v.union(v.literal("HOST"), v.literal("PLAYER")),
    isConnected: v.boolean(),
    isReady: v.boolean(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_and_user", ["roomId", "userId"]),

  characters: defineTable({
    userId: v.id("users"),
    roomId: v.id("rooms"),
    characterName: v.string(),
    characterClass: v.union(
      v.literal("Warrior"),
      v.literal("Mage"),
      v.literal("Archer"),
      v.literal("Rogue"),
      v.literal("Healer"),
    ),
    avatar: v.string(),
    level: v.number(),
    experience: v.number(),
    health: v.number(),
    strength: v.number(),
    defense: v.number(),
    currentHealth: v.number(),
    gold: v.number(),
    readyForGame: v.boolean(),
  })
    .index("by_room_and_user", ["roomId", "userId"])
    .index("by_room_and_name", ["roomId", "characterName"]),

  gameStates: defineTable({
    roomId: v.id("rooms"),
    currentLocationId: v.optional(v.id("locations")),
    currentLocation: v.string(),
    currentTime: v.string(),
    weather: v.string(),
    currentQuest: v.string(),
    activeNpcs: v.array(sceneNpc),
    activeMonsters: v.array(monster),
    objects: v.array(sceneObject),
    inventory: v.object({
      party: v.array(v.string()),
    }),
    worldFlags: v.object({
      visitedLocations: v.array(v.string()),
      completedQuests: v.array(v.string()),
      killedMonsters: v.array(v.string()),
      openedChests: v.array(v.string()),
      destroyedObjects: v.array(v.string()),
      npcRelationships: v.record(v.string(), v.number()),
    }),
    turnIndex: v.number(),
    turnStage: v.union(
      v.literal("player"),
      v.literal("enemy"),
      v.literal("world"),
    ),
  }).index("by_room", ["roomId"]),

  gameEvents: defineTable({
    roomId: v.id("rooms"),
    eventType: v.string(),
    details: v.any(),
  }).index("by_room", ["roomId"]),

  playerActions: defineTable({
    roomId: v.id("rooms"),
    userId: v.id("users"),
    actionText: v.string(),
    resolvedStatus: v.union(
      v.literal("success"),
      v.literal("failed"),
      v.literal("rejected"),
    ),
    outcome: v.string(),
  }).index("by_room", ["roomId"]),

  storyHistory: defineTable({
    roomId: v.id("rooms"),
    entryText: v.string(),
  }).index("by_room", ["roomId"]),

  npcs: defineTable({
    roomId: v.id("rooms"),
    locationId: v.optional(v.id("locations")),
    name: v.string(),
    race: v.string(),
    profession: v.string(),
    personality: v.string(),
    mood: v.string(),
    inventory: v.any(),
    relationships: v.record(v.string(), v.number()),
    dailySchedule: v.string(),
    goals: v.string(),
  }).index("by_room", ["roomId"]),

  npcMemories: defineTable({
    npcId: v.id("npcs"),
    characterName: v.string(),
    playerMessage: v.string(),
    npcResponse: v.string(),
    rumor: v.optional(v.string()),
  })
    .index("by_npc", ["npcId"])
    .index("by_npc_and_character", ["npcId", "characterName"]),

  biomes: defineTable({
    name: v.string(),
    description: v.string(),
  }).index("by_name", ["name"]),

  regions: defineTable({
    roomId: v.id("rooms"),
    name: v.string(),
    description: v.string(),
  }).index("by_room", ["roomId"]),

  locations: defineTable({
    roomId: v.id("rooms"),
    regionId: v.optional(v.id("regions")),
    biomeId: v.optional(v.id("biomes")),
    name: v.string(),
    description: v.string(),
    biome: v.string(),
    connectedLocations: v.array(v.id("locations")),
    npcList: v.array(v.object({ name: v.string(), dialogue: v.string() })),
    monsterList: v.array(monster),
    lootTable: v.object({ gold: v.number(), items: v.array(v.string()) }),
    weather: v.string(),
    dangerLevel: v.number(),
  }).index("by_room", ["roomId"]),

  buildings: defineTable({
    locationId: v.id("locations"),
    name: v.string(),
    type: v.string(),
    description: v.string(),
    npcList: v.array(v.object({ name: v.string(), dialogue: v.string() })),
    inventory: v.any(),
  }).index("by_location", ["locationId"]),

  worldObjects: defineTable({
    locationId: v.id("locations"),
    name: v.string(),
    type: v.string(),
    status: v.string(),
    details: v.any(),
  }).index("by_location", ["locationId"]),
});
