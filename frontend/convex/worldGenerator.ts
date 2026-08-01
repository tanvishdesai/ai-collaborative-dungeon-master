import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  flattenWorldObject,
  npcListToSceneNpcs,
} from "./lib/sceneHelpers";

const BIOMES = [
  ["Plains", "Flat grasslands and gentle valleys, ideal for settlements."],
  ["Forest", "Dense woodlands filled with towering trees and hidden shadows."],
  ["River", "Flowing watercourses, wetlands, and aquatic creatures."],
  ["Mountain", "Rugged cliffs, freezing peaks, and vertical passes."],
  ["Dungeon", "Subterranean crypts, caves, and ancient underground vaults."],
  ["Castle", "Gothic fortresses, keeps, and stone castles."],
] as const;

export const generateWorld = internalMutation({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    const biomeIds: Record<string, Id<"biomes">> = {};
    for (const [name, description] of BIOMES) {
      const existing = await ctx.db
        .query("biomes")
        .withIndex("by_name", (q) => q.eq("name", name))
        .unique();
      if (existing) {
        biomeIds[name] = existing._id;
      } else {
        biomeIds[name] = await ctx.db.insert("biomes", { name, description });
      }
    }

    const regionId = await ctx.db.insert("regions", {
      roomId,
      name: "The Forgotten Vale",
      description:
        "A secluded valley forgotten by mapmakers, harboring ancient secrets.",
    });

    const villageId = await ctx.db.insert("locations", {
      roomId,
      regionId,
      biomeId: biomeIds.Plains,
      name: "Stoneford Village",
      description:
        "A peaceful village built next to a river crossing. Safe but filled with rumors.",
      biome: "Plains",
      connectedLocations: [],
      npcList: [
        {
          name: "Elder Jonas",
          dialogue:
            "Travelers! Beware the Whispering Forest to our north. Shadows walk there.",
        },
      ],
      monsterList: [],
      lootTable: { gold: 0, items: [] },
      weather: "Clear",
      dangerLevel: 0,
    });

    const forestId = await ctx.db.insert("locations", {
      roomId,
      regionId,
      biomeId: biomeIds.Forest,
      name: "Whispering Forest",
      description:
        "A dense canopy where the wind sounds like whispered warnings. Hostile creatures lurk here.",
      biome: "Forest",
      connectedLocations: [],
      npcList: [],
      monsterList: [
        {
          name: "gnoll hunter",
          health: 35,
          maxHealth: 35,
          damage: 10,
          defense: 2,
          xp: 60,
          gold: 25,
        },
      ],
      lootTable: { gold: 15, items: ["healing herb"] },
      weather: "Foggy",
      dangerLevel: 1,
    });

    const riverId = await ctx.db.insert("locations", {
      roomId,
      regionId,
      biomeId: biomeIds.River,
      name: "Silver River",
      description:
        "The sparkling waters of the Silver River. Strong currents and water elementals block passage.",
      biome: "River",
      connectedLocations: [],
      npcList: [],
      monsterList: [
        {
          name: "water elemental",
          health: 45,
          maxHealth: 45,
          damage: 12,
          defense: 4,
          xp: 90,
          gold: 30,
        },
      ],
      lootTable: { gold: 20, items: ["mana potion"] },
      weather: "Rainy",
      dangerLevel: 2,
    });

    const mountainId = await ctx.db.insert("locations", {
      roomId,
      regionId,
      biomeId: biomeIds.Mountain,
      name: "Spine Mountain",
      description:
        "A treacherous, rocky path heading high into the snowline. Mountain trolls patrol the heights.",
      biome: "Mountain",
      connectedLocations: [],
      npcList: [],
      monsterList: [
        {
          name: "mountain troll",
          health: 65,
          maxHealth: 65,
          damage: 15,
          defense: 5,
          xp: 150,
          gold: 60,
        },
      ],
      lootTable: { gold: 40, items: ["steel sword"] },
      weather: "Stormy",
      dangerLevel: 3,
    });

    const dungeonId = await ctx.db.insert("locations", {
      roomId,
      regionId,
      biomeId: biomeIds.Dungeon,
      name: "Cryptic Dungeon",
      description:
        "A dark, subterranean crypt full of dust, cobwebs, and undead mages searching for runic keys.",
      biome: "Dungeon",
      connectedLocations: [],
      npcList: [],
      monsterList: [
        {
          name: "skeletal mage",
          health: 55,
          maxHealth: 55,
          damage: 16,
          defense: 3,
          xp: 180,
          gold: 80,
        },
      ],
      lootTable: { gold: 100, items: ["crypt key"] },
      weather: "Foggy",
      dangerLevel: 4,
    });

    const castleId = await ctx.db.insert("locations", {
      roomId,
      regionId,
      biomeId: biomeIds.Castle,
      name: "Shadowfang Castle",
      description:
        "A towering, dark stone castle overlooking the vale. A vampire lord rules from his throne room.",
      biome: "Castle",
      connectedLocations: [],
      npcList: [],
      monsterList: [
        {
          name: "vampire lord",
          health: 110,
          maxHealth: 110,
          damage: 22,
          defense: 6,
          xp: 350,
          gold: 250,
        },
      ],
      lootTable: { gold: 300, items: ["Holy Grail"] },
      weather: "Stormy",
      dangerLevel: 5,
    });

    await ctx.db.patch(villageId, {
      connectedLocations: [forestId, mountainId],
    });
    await ctx.db.patch(forestId, {
      connectedLocations: [villageId, riverId, castleId],
    });
    await ctx.db.patch(riverId, {
      connectedLocations: [forestId, dungeonId],
    });
    await ctx.db.patch(mountainId, {
      connectedLocations: [villageId],
    });
    await ctx.db.patch(dungeonId, {
      connectedLocations: [riverId],
    });
    await ctx.db.patch(castleId, {
      connectedLocations: [forestId],
    });

    await ctx.db.insert("npcs", {
      roomId,
      locationId: villageId,
      name: "Barman Ted",
      race: "Human",
      profession: "Barman",
      personality: "Gruff, friendly, talkative about rumors",
      mood: "Tired",
      inventory: { mead: 5, ale: 10 },
      relationships: {},
      dailySchedule:
        "Morning: Stocking ale at the cellar, Afternoon/Night: Tending the bar at The Rusty Anchor Tavern",
      goals: "Keep the tavern running, hear all gossip in the valley",
    });

    await ctx.db.insert("npcs", {
      roomId,
      locationId: villageId,
      name: "Merchant Alaric",
      race: "Dwarf",
      profession: "Merchant",
      personality: "Jolly, shrewd, likes hard bargaining",
      mood: "Happy",
      inventory: { "health potion": 3, "mana potion": 3 },
      relationships: {},
      dailySchedule:
        "Morning/Afternoon: Running the merchant stall in the market square, Night: Drinking at the tavern",
      goals: "Earn gold, buy rare artifacts from adventurers",
    });

    await ctx.db.insert("npcs", {
      roomId,
      locationId: villageId,
      name: "Priestess Alara",
      race: "Elf",
      profession: "Priestess",
      personality: "Peaceful, soft-spoken, spiritual",
      mood: "Peaceful",
      inventory: { "holy water": 2 },
      relationships: {},
      dailySchedule:
        "Morning: Prayers at the altar, Afternoon: Guiding villagers, Night: Studying ancient texts",
      goals: "Promote light and healing, cleanse dungeon evil",
    });

    await ctx.db.insert("npcs", {
      roomId,
      locationId: villageId,
      name: "Wizard Elidor",
      race: "Human",
      profession: "Wizard",
      personality: "Wise, cryptic, secretive about magic",
      mood: "Suspicious",
      inventory: { "magic scroll": 1 },
      relationships: {},
      dailySchedule:
        "Morning: Reading in the tower, Afternoon: Walking near the stone gate, Night: Observing the stars",
      goals: "Research the ancient seals, guide chosen heroes",
    });

    await ctx.db.insert("npcs", {
      roomId,
      locationId: forestId,
      name: "Herbalist Aerith",
      race: "Elf",
      profession: "Herbalist",
      personality: "Gentle, nervous, desperately helpful",
      mood: "Anxious",
      inventory: { "healing herb": 4, elixir: 1 },
      relationships: {},
      dailySchedule:
        "Morning: Gathering herbs in the forest, Afternoon/Night: Hiding in the forest camp",
      goals: "Survival, reward brave heroes who heal her wounds",
    });

    await ctx.db.insert("buildings", {
      locationId: villageId,
      name: "Wandering Merchant's Guild",
      type: "shop",
      description: "A small wooden store selling potions and simple gear.",
      npcList: [
        {
          name: "Merchant Alaric",
          dialogue:
            "Looking to buy? I have the finest potions in the vale!",
        },
      ],
      inventory: {
        items: ["health potion", "mana potion"],
        prices: { "health potion": 25, "mana potion": 25 },
      },
    });

    await ctx.db.insert("buildings", {
      locationId: villageId,
      name: "The Rusty Anchor Tavern",
      type: "tavern",
      description: "A cozy, bustling tavern offering warm fire, food, and rumors.",
      npcList: [
        {
          name: "Barman Ted",
          dialogue:
            "Welcome to the Rusty Anchor! Watch out for the trolls up on Spine Mountain.",
        },
        {
          name: "Bard Elidor",
          dialogue:
            "They say the skeletal mages in the Cryptic Dungeon hold a key to Shadowfang Castle.",
        },
      ],
      inventory: {
        drinks: ["dwarven ale", "mead"],
        prices: { "dwarven ale": 5, mead: 8 },
      },
    });

    await ctx.db.insert("buildings", {
      locationId: villageId,
      name: "Plains Altar Temple",
      type: "temple",
      description:
        "A serene temple offering healing and respite for weary adventurers.",
      npcList: [
        {
          name: "Priestess Alara",
          dialogue:
            "May the light bless your path. Rest here and heal your wounds.",
        },
      ],
      inventory: { blessings: ["heal"], prices: { heal: 10 } },
    });

    await ctx.db.insert("worldObjects", {
      locationId: dungeonId,
      name: "iron gate",
      type: "gate",
      status: "locked",
      details: { requires: "crypt key" },
    });

    await ctx.db.insert("worldObjects", {
      locationId: forestId,
      name: "moldy chest",
      type: "chest",
      status: "closed",
      details: { items: ["health potion"], gold: 20 },
    });

    const village = (await ctx.db.get(villageId))!;
    const startNpcs = npcListToSceneNpcs(village.npcList);
    const startMonsters = village.monsterList;
    const startObjects: ReturnType<typeof flattenWorldObject>[] = [];

    return {
      startLocationId: villageId,
      startLocationName: village.name,
      startLocationDesc: village.description,
      startWeather: village.weather,
      startNpcs,
      startMonsters,
      startObjects,
    };
  },
});
