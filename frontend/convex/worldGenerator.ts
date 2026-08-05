import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import {
  flattenWorldObject,
  npcListToSceneNpcs,
} from "./lib/sceneHelpers";

const BIOMES = [
  ["Plains", "Open fields and gentle river-plains, dotted with peepal trees and mud-and-thatch homes — the heart of village life."],
  ["Forest", "A dense jungle of sal and banyan, where the wind carries whispered warnings and unseen things watch from the shadows."],
  ["River", "Sacred flowing waters, ghats, and reed-choked banks where water-spirits and nagas guard the crossings."],
  ["Mountain", "The frozen slopes of the great Himalaya, cut by trident-shaped peaks and haunted by mountain rakshasas."],
  ["Dungeon", "The Patala under-realm — lightless crypts, dust, and cobwebbed vaults where restless spirits and bone-tantriks dwell."],
  ["Castle", "Ancient stone forts (durgs) crowning the hills, their halls ruled by asuras and vetalas since the age of the devas."],
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
      name: "Vismrit Ghati",
      description:
        "The Forgotten Valley — a hidden vale below the Himalayas that mapmakers erased and time forgot, still holding secrets from the age of devas and asuras.",
    });

    const villageId = await ctx.db.insert("locations", {
      roomId,
      regionId,
      biomeId: biomeIds.Plains,
      name: "Shilagram Village",
      description:
        "A peaceful village beside a river ghat, its lanes fragrant with cooking fires and marigold. Safe, but thick with whispered rumours.",
      biome: "Plains",
      connectedLocations: [],
      npcList: [
        {
          name: "Mukhiya Raghunath",
          dialogue:
            "Beware, travellers! To our north lies the Sarpavan — the Whispering Forest. Rakshasas walk among its shadows.",
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
      name: "Sarpavan Forest",
      description:
        "The Whispering Forest, a dense canopy of sal and banyan where the wind hisses like a warning. Rakshasas and prowling spirits hunt the unwary here.",
      biome: "Forest",
      connectedLocations: [],
      npcList: [],
      monsterList: [
        {
          name: "rakshasa prowler",
          health: 35,
          maxHealth: 35,
          damage: 10,
          defense: 2,
          xp: 60,
          gold: 25,
        },
      ],
      lootTable: { gold: 15, items: ["sanjeevani herb"] },
      weather: "Foggy",
      dangerLevel: 1,
    });

    const riverId = await ctx.db.insert("locations", {
      roomId,
      regionId,
      biomeId: biomeIds.River,
      name: "Rupya Nadi",
      description:
        "The Silver River, its holy waters glittering under the sun. Fierce currents and a coiling jal naga bar the crossing.",
      biome: "River",
      connectedLocations: [],
      npcList: [],
      monsterList: [
        {
          name: "jal naga",
          health: 45,
          maxHealth: 45,
          damage: 12,
          defense: 4,
          xp: 90,
          gold: 30,
        },
      ],
      lootTable: { gold: 20, items: ["soma potion"] },
      weather: "Rainy",
      dangerLevel: 2,
    });

    const mountainId = await ctx.db.insert("locations", {
      roomId,
      regionId,
      biomeId: biomeIds.Mountain,
      name: "Trishul Peak",
      description:
        "A treacherous, rock-strewn path climbing into the snowline of the trident-shaped mountain. Hulking mountain rakshasas patrol the heights.",
      biome: "Mountain",
      connectedLocations: [],
      npcList: [],
      monsterList: [
        {
          name: "pahadi rakshasa",
          health: 65,
          maxHealth: 65,
          damage: 15,
          defense: 5,
          xp: 150,
          gold: 60,
        },
      ],
      lootTable: { gold: 40, items: ["steel talwar"] },
      weather: "Stormy",
      dangerLevel: 3,
    });

    const dungeonId = await ctx.db.insert("locations", {
      roomId,
      regionId,
      biomeId: biomeIds.Dungeon,
      name: "Patala Crypt",
      description:
        "A lightless under-realm crypt thick with dust and cobwebs, where undead bone-tantriks chant over lost runic keys.",
      biome: "Dungeon",
      connectedLocations: [],
      npcList: [],
      monsterList: [
        {
          name: "asthi tantrik",
          health: 55,
          maxHealth: 55,
          damage: 16,
          defense: 3,
          xp: 180,
          gold: 80,
        },
      ],
      lootTable: { gold: 100, items: ["patala key"] },
      weather: "Foggy",
      dangerLevel: 4,
    });

    const castleId = await ctx.db.insert("locations", {
      roomId,
      regionId,
      biomeId: biomeIds.Castle,
      name: "Chhaya Durg",
      description:
        "The Shadow Fort — a towering black-stone durg brooding over the valley. A dreaded Vetala King holds court from its throne of bone.",
      biome: "Castle",
      connectedLocations: [],
      npcList: [],
      monsterList: [
        {
          name: "vetala king",
          health: 110,
          maxHealth: 110,
          damage: 22,
          defense: 6,
          xp: 350,
          gold: 250,
        },
      ],
      lootTable: { gold: 300, items: ["Amrit Kalash"] },
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
      name: "Sarai-keeper Devdas",
      race: "Manav",
      profession: "Innkeeper",
      personality: "Gruff, warm-hearted, endlessly full of gossip",
      mood: "Tired",
      inventory: { thandai: 5, lassi: 10 },
      relationships: {},
      dailySchedule:
        "Morning: Churning thandai in the cellar, Afternoon/Night: Running the Peepal Chhaya Sarai",
      goals: "Keep the sarai lamps lit and hear every rumour in the valley",
    });

    await ctx.db.insert("npcs", {
      roomId,
      locationId: villageId,
      name: "Seth Amrit",
      race: "Yaksha",
      profession: "Merchant",
      personality: "Jolly, shrewd, loves a hard bargain",
      mood: "Happy",
      inventory: { "sanjeevani potion": 3, "soma potion": 3 },
      relationships: {},
      dailySchedule:
        "Morning/Afternoon: Minding his stall in the village haat, Night: Sipping thandai at the sarai",
      goals: "Earn gold and buy rare relics from wandering adventurers",
    });

    await ctx.db.insert("npcs", {
      roomId,
      locationId: villageId,
      name: "Pujarin Anasuya",
      race: "Gandharva",
      profession: "Priestess",
      personality: "Serene, soft-spoken, deeply devout",
      mood: "Peaceful",
      inventory: { gangajal: 2 },
      relationships: {},
      dailySchedule:
        "Morning: Aarti at the mandir, Afternoon: Guiding villagers, Night: Studying ancient shlokas",
      goals: "Spread light and healing, and cleanse the evil of the Patala Crypt",
    });

    await ctx.db.insert("npcs", {
      roomId,
      locationId: villageId,
      name: "Rishi Vidyut",
      race: "Manav",
      profession: "Tantrik-Sage",
      personality: "Wise, cryptic, guarded about his mantras",
      mood: "Suspicious",
      inventory: { "mantra scroll": 1 },
      relationships: {},
      dailySchedule:
        "Morning: Reading in his ashram tower, Afternoon: Walking near the stone gate, Night: Reading the stars",
      goals: "Study the ancient seals and guide the chosen heroes",
    });

    await ctx.db.insert("npcs", {
      roomId,
      locationId: forestId,
      name: "Vaidya Ahalya",
      race: "Gandharva",
      profession: "Herbalist",
      personality: "Gentle, nervous, desperately helpful",
      mood: "Anxious",
      inventory: { "sanjeevani herb": 4, "amrit elixir": 1 },
      relationships: {},
      dailySchedule:
        "Morning: Gathering jadi-buti herbs in the forest, Afternoon/Night: Hiding in her forest camp",
      goals: "Survive, and reward the brave who tend her wounds",
    });

    await ctx.db.insert("buildings", {
      locationId: villageId,
      name: "Ghumakkad Vyapari's Haat",
      type: "shop",
      description: "A small wooden stall selling potions and simple gear.",
      npcList: [
        {
          name: "Seth Amrit",
          dialogue:
            "Looking to buy, friend? I stock the finest potions in the whole valley!",
        },
      ],
      inventory: {
        items: ["sanjeevani potion", "soma potion"],
        prices: { "sanjeevani potion": 25, "soma potion": 25 },
      },
    });

    await ctx.db.insert("buildings", {
      locationId: villageId,
      name: "The Peepal Chhaya Sarai",
      type: "tavern",
      description: "A cosy, bustling rest-house offering warm fire, hot food, and hotter rumours.",
      npcList: [
        {
          name: "Sarai-keeper Devdas",
          dialogue:
            "Welcome to the Peepal Chhaya! Mind the mountain rakshasas up on Trishul Peak.",
        },
        {
          name: "Kavi Suradas",
          dialogue:
            "They say the bone-tantriks in the Patala Crypt guard a key to Chhaya Durg itself.",
        },
      ],
      inventory: {
        drinks: ["saffron thandai", "sweet lassi"],
        prices: { "saffron thandai": 5, "sweet lassi": 8 },
      },
    });

    await ctx.db.insert("buildings", {
      locationId: villageId,
      name: "The Riverside Mandir",
      type: "temple",
      description:
        "A serene riverside temple offering healing and rest to weary travellers.",
      npcList: [
        {
          name: "Pujarin Anasuya",
          dialogue:
            "May the Devi light your path. Rest here, and let your wounds be healed.",
        },
      ],
      inventory: { blessings: ["heal"], prices: { heal: 10 } },
    });

    await ctx.db.insert("worldObjects", {
      locationId: dungeonId,
      name: "Naga gate",
      type: "gate",
      status: "locked",
      details: { requires: "patala key" },
    });

    await ctx.db.insert("worldObjects", {
      locationId: forestId,
      name: "old sandook",
      type: "chest",
      status: "closed",
      details: { items: ["sanjeevani potion"], gold: 20 },
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
