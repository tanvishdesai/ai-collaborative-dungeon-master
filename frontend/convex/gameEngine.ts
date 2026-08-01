import {
  query,
  mutation,
  internalMutation,
  QueryCtx,
} from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import { requireRoomPlayer } from "./lib/authHelpers";
import {
  flattenWorldObject,
  npcListToSceneNpcs,
  SceneObject,
} from "./lib/sceneHelpers";

function randomInt1to6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function normalizeAction(actionText: string): string {
  let cleaned = actionText.toLowerCase().trim();
  cleaned = cleaned.replace(/^(i|we|the party)\s+/, "");
  cleaned = cleaned.replace(/[.!?]+$/, "");
  return cleaned;
}

function stripArticle(target: string): string {
  return target.replace(/^(the|a|an)\s+/, "").trim();
}

function updateQuest(gameState: Doc<"gameStates">): string | null {
  const loc = gameState.currentLocation;
  const quest = gameState.currentQuest;
  const flags = gameState.worldFlags;

  if (quest === `Explore ${loc}` && gameState.activeMonsters.length === 0) {
    return `Clear threats at ${loc}`;
  }

  if (
    quest === `Clear threats at ${loc}` &&
    gameState.activeMonsters.length === 0 &&
    !flags.completedQuests.includes(`Cleared ${loc}`)
  ) {
    return "Explore the Forgotten Vale";
  }

  if (
    flags.openedChests.includes("moldy chest") &&
    !quest.includes("iron gate") &&
    !flags.completedQuests.includes("Opened moldy chest")
  ) {
    return "Unlock the iron gate in Cryptic Dungeon";
  }

  if (
    flags.openedChests.includes("iron gate") &&
    quest.includes("iron gate")
  ) {
    return "Defeat the vampire lord at Shadowfang Castle";
  }

  if (
    flags.killedMonsters.includes("vampire lord") &&
    !quest.includes("Holy Grail")
  ) {
    return "Claim victory — the Holy Grail awaits!";
  }

  if (gameState.activeMonsters.length === 0 && quest.startsWith("Explore ")) {
    const exploreTarget = quest.replace("Explore ", "");
    if (exploreTarget === loc) {
      return `Clear threats at ${loc}`;
    }
  }

  return null;
}

async function loadLocationObjects(
  ctx: { db: QueryCtx["db"] },
  locationId: Id<"locations">,
): Promise<SceneObject[]> {
  const worldObjects = await ctx.db
    .query("worldObjects")
    .withIndex("by_location", (q) => q.eq("locationId", locationId))
    .collect();
  return worldObjects
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(flattenWorldObject);
}

export const get = query({
  args: { roomId: v.id("rooms") },
  handler: async (ctx, { roomId }) => {
    await requireRoomPlayer(ctx, roomId);
    return await ctx.db
      .query("gameStates")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .unique();
  },
});

export const initializeGame = internalMutation({
  args: {
    roomId: v.id("rooms"),
    startLocationId: v.id("locations"),
    startLocationName: v.string(),
    startLocationDesc: v.string(),
    startWeather: v.string(),
    startNpcs: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        health: v.number(),
        status: v.string(),
        dialogue: v.string(),
      }),
    ),
    startMonsters: v.array(
      v.object({
        name: v.string(),
        health: v.number(),
        maxHealth: v.number(),
        damage: v.number(),
        defense: v.number(),
        xp: v.number(),
        gold: v.number(),
      }),
    ),
    startObjects: v.array(
      v.object({
        name: v.string(),
        type: v.string(),
        status: v.string(),
        items: v.optional(v.array(v.string())),
        gold: v.optional(v.number()),
        requires: v.optional(v.string()),
        leadsTo: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gameStates")
      .withIndex("by_room", (q) => q.eq("roomId", args.roomId))
      .unique();

    if (existing) return existing;

    const gameStateId = await ctx.db.insert("gameStates", {
      roomId: args.roomId,
      currentLocationId: args.startLocationId,
      currentLocation: args.startLocationName,
      currentTime: "Day 1 - Morning",
      weather: args.startWeather,
      currentQuest: `Explore ${args.startLocationName}`,
      activeNpcs: args.startNpcs,
      activeMonsters: args.startMonsters,
      objects: args.startObjects,
      inventory: { party: [] },
      worldFlags: {
        visitedLocations: [args.startLocationName],
        completedQuests: [],
        killedMonsters: [],
        openedChests: [],
        destroyedObjects: [],
        npcRelationships: {},
      },
      turnIndex: 0,
      turnStage: "player",
    });

    await ctx.db.insert("storyHistory", {
      roomId: args.roomId,
      entryText: args.startLocationDesc,
    });

    await ctx.db.insert("gameEvents", {
      roomId: args.roomId,
      eventType: "Game Started",
      details: { narrative: args.startLocationDesc },
    });

    return await ctx.db.get(gameStateId);
  },
});

export const processAction = mutation({
  args: {
    roomId: v.id("rooms"),
    actionText: v.string(),
  },
  handler: async (ctx, { roomId, actionText }) => {
    const { user } = await requireRoomPlayer(ctx, roomId);

    const room = await ctx.db.get(roomId);
    if (!room) throw new ConvexError("Room not found.");
    if (room.status !== "playing") {
      throw new ConvexError("Game is not active in this room.");
    }

    const gameState = await ctx.db
      .query("gameStates")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .unique();

    if (!gameState) {
      throw new ConvexError("Game has not been initialized for this room.");
    }

    const character = await ctx.db
      .query("characters")
      .withIndex("by_room_and_user", (q) =>
        q.eq("roomId", roomId).eq("userId", user._id),
      )
      .unique();

    if (!character) {
      throw new ConvexError("Character not found for this player in the room.");
    }

    if (character.currentHealth <= 0) {
      throw new ConvexError(
        "Your character is dead and cannot perform actions. Use 'revive' or wait.",
      );
    }

    const cleanedAction = normalizeAction(actionText);

    let resolvedStatus: "success" | "failed" | "rejected" = "rejected";
    let outcome =
      "I don't understand that action. Try commands like: 'inspect room', 'open moldy chest', 'go to whispering forest', 'attack gnoll hunter', 'talk to elder jonas', or 'use health potion'.";
    let eventType = "Player Action Attempted";
    let eventDetails: Record<string, unknown> = {};

    const activeNpcs = [...gameState.activeNpcs];
    const activeMonsters = [...gameState.activeMonsters];
    const objects = [...gameState.objects];
    const inventory = { party: [...gameState.inventory.party] };
    const worldFlags = {
      ...gameState.worldFlags,
      visitedLocations: [...gameState.worldFlags.visitedLocations],
      completedQuests: [...gameState.worldFlags.completedQuests],
      killedMonsters: [...gameState.worldFlags.killedMonsters],
      openedChests: [...gameState.worldFlags.openedChests],
      destroyedObjects: [...gameState.worldFlags.destroyedObjects],
      npcRelationships: { ...gameState.worldFlags.npcRelationships },
    };

    let currentLocation = gameState.currentLocation;
    let currentLocationId = gameState.currentLocationId;
    let weather = gameState.weather;
    let currentQuest = gameState.currentQuest;
    let currentTime = gameState.currentTime;

    let characterPatch: Partial<Doc<"characters">> = {};

    // 1. INSPECT
    if (
      ["inspect", "look at", "look around", "search"].some((v) =>
        cleanedAction.startsWith(v),
      )
    ) {
      let target = cleanedAction
        .replace(/^(inspect|look at|look around|search)\s+/, "")
        .trim();
      target = stripArticle(target);

      if (!target || ["room", "area", "around", "surroundings"].includes(target)) {
        const monstersDesc = activeMonsters.length
          ? activeMonsters.map((m) => m.name).join(", ")
          : "no hostile monsters";
        const npcsDesc = activeNpcs.length
          ? activeNpcs.map((n) => n.name).join(", ")
          : "no NPCs";
        const objectsDesc = objects.length
          ? objects.map((o) => o.name).join(", ")
          : "no items";
        outcome = `You look around ${currentLocation}. You see ${objectsDesc}. There are ${npcsDesc} and ${monstersDesc}.`;
        resolvedStatus = "success";
      } else {
        const matchedObj = objects.find((o) =>
          target.includes(o.name.toLowerCase()),
        );
        const matchedNpc = activeNpcs.find(
          (n) =>
            target.includes(n.name.toLowerCase()) ||
            target.includes(n.type.toLowerCase()),
        );
        const matchedMonster = activeMonsters.find((m) =>
          target.includes(m.name.toLowerCase()),
        );

        if (matchedObj) {
          outcome = `You inspect the ${matchedObj.name}. It is currently ${matchedObj.status}.`;
          resolvedStatus = "success";
        } else if (matchedNpc) {
          outcome = `You look at ${matchedNpc.name}. Status: ${matchedNpc.status}. HP: ${matchedNpc.health}/100.`;
          resolvedStatus = "success";
        } else if (matchedMonster) {
          outcome = `You inspect the ${matchedMonster.name}. HP: ${matchedMonster.health}/${matchedMonster.maxHealth}. It looks aggressive!`;
          resolvedStatus = "success";
        } else {
          outcome = `There is no '${target}' here to inspect.`;
          resolvedStatus = "rejected";
        }
      }
    }
    // 2. OPEN
    else if (cleanedAction.startsWith("open ")) {
      const target = stripArticle(cleanedAction.slice(5).trim());
      const matchedObj = objects.find((o) =>
        target.includes(o.name.toLowerCase()),
      );

      if (matchedObj) {
        if (matchedObj.type === "chest") {
          if (matchedObj.status === "open") {
            outcome = `The ${matchedObj.name} is already open.`;
            resolvedStatus = "failed";
          } else {
            matchedObj.status = "open";
            const itemsFound = matchedObj.items ?? [];
            const goldFound = matchedObj.gold ?? 0;
            if (itemsFound.length) inventory.party.push(...itemsFound);
            characterPatch.gold = character.gold + goldFound;
            if (!worldFlags.openedChests.includes(matchedObj.name)) {
              worldFlags.openedChests.push(matchedObj.name);
            }
            resolvedStatus = "success";
            outcome = `You open the ${matchedObj.name}! Inside you find: ${itemsFound.join(", ") || "nothing"} and ${goldFound} gold.`;
            eventType = "Item Collected";
            eventDetails = {
              object: matchedObj.name,
              items: itemsFound,
              gold: goldFound,
            };
          }
        } else if (matchedObj.type === "gate") {
          if (matchedObj.status === "open") {
            outcome = `The ${matchedObj.name} is already open.`;
            resolvedStatus = "failed";
          } else {
            const keyNeeded = matchedObj.requires;
            if (keyNeeded && inventory.party.includes(keyNeeded)) {
              inventory.party = inventory.party.filter((i) => i !== keyNeeded);
              matchedObj.status = "open";
              if (!worldFlags.openedChests.includes(matchedObj.name)) {
                worldFlags.openedChests.push(matchedObj.name);
              }
              resolvedStatus = "success";
              outcome = `You unlock and open the ${matchedObj.name} using the ${keyNeeded}!${matchedObj.leadsTo ? ` The path to ${matchedObj.leadsTo} is now clear.` : ""}`;
              eventType = "Door Opened";
              eventDetails = { object: matchedObj.name };
            } else {
              outcome = `The ${matchedObj.name} is locked. You need a ${keyNeeded} to open it.`;
              resolvedStatus = "failed";
            }
          }
        } else {
          outcome = `You cannot open the ${matchedObj.name}.`;
          resolvedStatus = "rejected";
        }
      } else {
        outcome = `There is no '${target}' here to open.`;
        resolvedStatus = "rejected";
      }
    }
    // 3. ATTACK
    else if (
      ["attack ", "fight ", "kill "].some((v) => cleanedAction.startsWith(v))
    ) {
      const target = stripArticle(
        cleanedAction.replace(/^(attack|fight|kill)\s+/, "").trim(),
      );
      const matchedMonster = activeMonsters.find((m) =>
        target.includes(m.name.toLowerCase()),
      );
      const matchedNpc = activeNpcs.find(
        (n) =>
          target.includes(n.name.toLowerCase()) ||
          target.includes(n.type.toLowerCase()),
      );

      if (matchedMonster) {
        const damageRoll = randomInt1to6();
        const damage = Math.max(
          1,
          character.strength + damageRoll - matchedMonster.defense,
        );
        matchedMonster.health -= damage;

        if (matchedMonster.health <= 0) {
          const idx = activeMonsters.indexOf(matchedMonster);
          activeMonsters.splice(idx, 1);
          worldFlags.killedMonsters.push(matchedMonster.name);

          const xpGained = matchedMonster.xp;
          const goldGained = matchedMonster.gold;
          let newExp = character.experience + xpGained;
          let newGold = character.gold + goldGained;
          let newLevel = character.level;
          let levelUpMsg = "";

          characterPatch.experience = newExp;
          characterPatch.gold = newGold;

          if (newExp >= character.level * 100) {
            const threshold = character.level * 100;
            newExp -= threshold;
            newLevel += 1;
            characterPatch.experience = newExp;
            characterPatch.level = newLevel;
            characterPatch.health = character.health + 20;
            characterPatch.currentHealth = character.health + 20;
            characterPatch.mana = character.mana + 10;
            characterPatch.currentMana = character.mana + 10;
            characterPatch.strength = character.strength + 2;
            characterPatch.defense = character.defense + 1;
            levelUpMsg = ` Character leveled up! ${character.characterName} is now Level ${newLevel}!`;
          }

          outcome = `You attack the ${matchedMonster.name} for ${damage} damage and slay it! Gained ${xpGained} XP and ${goldGained} gold.${levelUpMsg}`;
          resolvedStatus = "success";
          eventType = "Item Collected";
          eventDetails = {
            killed: matchedMonster.name,
            xp: xpGained,
            gold: goldGained,
          };
          if (levelUpMsg) {
            eventDetails.levelUp = {
              message: `${character.characterName} leveled up to ${newLevel}!`,
            };
          }
        } else {
          outcome = `You attack the ${matchedMonster.name} for ${damage} damage! (HP: ${matchedMonster.health}/${matchedMonster.maxHealth})`;
          resolvedStatus = "success";
          eventDetails = { damageDealt: damage, target: matchedMonster.name };
        }
      } else if (matchedNpc) {
        const npcName = matchedNpc.name;
        const rel = Math.max(
          0,
          (worldFlags.npcRelationships[npcName] ?? 50) - 20,
        );
        worldFlags.npcRelationships[npcName] = rel;
        outcome = `You attack ${npcName}, but they quickly block your blow! ${npcName}'s relationship drops to ${rel}.`;
        resolvedStatus = "failed";
        if (rel <= 10) {
          matchedNpc.status = "hostile";
          outcome += ` ${npcName} is now hostile!`;
        }
      } else {
        outcome = `There is no '${target}' here to attack.`;
        resolvedStatus = "rejected";
      }
    }
    // 4. TALK
    else if (
      ["talk to ", "speak to ", "talk ", "speak "].some((v) =>
        cleanedAction.startsWith(v),
      )
    ) {
      const target = stripArticle(
        cleanedAction.replace(/^(talk to|speak to|talk|speak)\s+/, "").trim(),
      );
      const matchedNpc = activeNpcs.find(
        (n) =>
          target.includes(n.name.toLowerCase()) ||
          target.includes(n.type.toLowerCase()),
      );

      if (matchedNpc) {
        if (matchedNpc.status === "hostile") {
          outcome = `${matchedNpc.name} refuses to speak with you and lunges aggressively!`;
          resolvedStatus = "failed";
        } else {
          outcome = `${matchedNpc.name} says: "${matchedNpc.dialogue}"`;
          resolvedStatus = "success";
          eventType = "NPC Joined";
          eventDetails = {
            npc: matchedNpc.name,
            dialogue: matchedNpc.dialogue,
          };
          if (
            matchedNpc.name.toLowerCase().includes("aerith") &&
            inventory.party.includes("health potion")
          ) {
            outcome +=
              " (You have a health potion! Type 'give potion to aerith' to heal her.)";
          }
        }
      } else {
        outcome = `There is no one here named '${target}' to speak to.`;
        resolvedStatus = "rejected";
      }
    }
    // 5. GO TO
    else if (
      ["go to ", "move to ", "travel to ", "go ", "move "].some((v) =>
        cleanedAction.startsWith(v),
      )
    ) {
      const target = stripArticle(
        cleanedAction
          .replace(/^(go to|move to|travel to|go|move)\s+/, "")
          .trim(),
      );

      if (!currentLocationId) {
        outcome = "Move failed: current location coordinate state invalid.";
        resolvedStatus = "failed";
      } else {
        const allLocs = await ctx.db
          .query("locations")
          .withIndex("by_room", (q) => q.eq("roomId", roomId))
          .collect();

        const destLoc = allLocs.find(
          (l) =>
            l.name.toLowerCase() === target ||
            target.includes(l.name.toLowerCase()) ||
            l.name.toLowerCase().includes(target),
        );

        if (!destLoc) {
          outcome = `I don't know of a location named '${target}'.`;
          resolvedStatus = "rejected";
        } else if (destLoc._id === currentLocationId) {
          outcome = `You are already at the ${destLoc.name}.`;
          resolvedStatus = "failed";
        } else {
          const currLoc = allLocs.find((l) => l._id === currentLocationId);
          if (!currLoc) {
            outcome = "Move failed: current location coordinate state invalid.";
            resolvedStatus = "failed";
          } else if (!currLoc.connectedLocations.includes(destLoc._id)) {
            outcome = `Move failed: ${destLoc.name} is not connected to your current location.`;
            resolvedStatus = "failed";
          } else {
            const oldLocName = currentLocation;
            currentLocationId = destLoc._id;
            currentLocation = destLoc.name;
            weather = destLoc.weather;
            activeNpcs.splice(0, activeNpcs.length, ...npcListToSceneNpcs(destLoc.npcList));
            activeMonsters.splice(
              0,
              activeMonsters.length,
              ...destLoc.monsterList.map(
                (m: (typeof destLoc.monsterList)[number]) => ({ ...m }),
              ),
            );
            const locObjects = await loadLocationObjects(ctx, destLoc._id);
            objects.splice(0, objects.length, ...locObjects);

            if (!worldFlags.visitedLocations.includes(destLoc.name)) {
              worldFlags.visitedLocations.push(destLoc.name);
            }

            resolvedStatus = "success";
            outcome = `You travel to the ${destLoc.name}.`;
            eventType = "Player Moved";
            eventDetails = { from: oldLocName, to: destLoc.name };
          }
        }
      }
    }
    // 6. DESTROY
    else if (
      ["destroy ", "break ", "smash "].some((v) => cleanedAction.startsWith(v))
    ) {
      const target = stripArticle(
        cleanedAction.replace(/^(destroy|break|smash)\s+/, "").trim(),
      );
      const matchedObj = objects.find((o) =>
        target.includes(o.name.toLowerCase()),
      );

      if (matchedObj) {
        if (matchedObj.status === "destroyed") {
          outcome = `The ${matchedObj.name} has already been destroyed.`;
          resolvedStatus = "failed";
        } else {
          matchedObj.status = "destroyed";
          worldFlags.destroyedObjects.push(matchedObj.name);
          resolvedStatus = "success";
          outcome = `You summon your strength and destroy the ${matchedObj.name}!`;
          eventType = "Door Opened";
          eventDetails = { object: matchedObj.name };
        }
      } else {
        outcome = `There is no '${target}' here to destroy.`;
        resolvedStatus = "rejected";
      }
    }
    // 7. USE / DRINK / GIVE / EQUIP
    else if (
      ["use ", "drink ", "give ", "equip "].some((v) =>
        cleanedAction.startsWith(v),
      )
    ) {
      const target = stripArticle(
        cleanedAction.replace(/^(use|drink|give|equip)\s+/, "").trim(),
      );

      if (target.includes("potion") || target.includes("health potion")) {
        if (
          target.includes("aerith") ||
          target.includes("elf") ||
          target.includes("potion to")
        ) {
          const aerithNpc = activeNpcs.find((n) =>
            n.name.toLowerCase().includes("aerith"),
          );
          if (!aerithNpc) {
            outcome = "Aerith is not here.";
            resolvedStatus = "failed";
          } else if (!inventory.party.includes("health potion")) {
            outcome = "You do not have a health potion to give.";
            resolvedStatus = "failed";
          } else {
            inventory.party = inventory.party.filter((i) => i !== "health potion");
            inventory.party.push("amulet of protection");
            const idx = activeNpcs.indexOf(aerithNpc);
            activeNpcs.splice(idx, 1);
            worldFlags.completedQuests.push("Helped Aerith");
            resolvedStatus = "success";
            outcome =
              "You offer a health potion to Aerith. She drinks it eagerly. " +
              "She stands up and breathes a sigh of relief: 'Thank you! You saved me. " +
              "Please take this Amulet of Protection as a token of my thanks.' " +
              "An amulet of protection (+5 defense when equipped) has been added to your inventory.";
            eventType = "NPC Joined";
            eventDetails = { npc: "Herbalist Aerith", reward: "amulet of protection" };
          }
        } else if (inventory.party.includes("health potion")) {
          inventory.party = inventory.party.filter((i) => i !== "health potion");
          const oldHp = character.currentHealth;
          const newHp = Math.min(character.health, character.currentHealth + 50);
          const healed = newHp - oldHp;
          characterPatch.currentHealth = newHp;
          resolvedStatus = "success";
          outcome = `You drink a health potion, restoring ${healed} HP! (HP: ${newHp}/${character.health})`;
          eventType = "Item Collected";
          eventDetails = {
            item: "health potion",
            recipient: character.characterName,
            healed,
          };
        } else {
          outcome = "The party does not have any health potions left.";
          resolvedStatus = "failed";
        }
      } else if (target.includes("sword") || target.includes("steel sword")) {
        if (inventory.party.includes("steel sword")) {
          inventory.party = inventory.party.filter((i) => i !== "steel sword");
          characterPatch.strength = character.strength + 4;
          resolvedStatus = "success";
          outcome = `You equip the steel sword. Your strength increases by 4! (Strength: ${character.strength + 4})`;
        } else {
          outcome = "You don't have a steel sword.";
          resolvedStatus = "failed";
        }
      } else if (target.includes("shield") || target.includes("iron shield")) {
        if (inventory.party.includes("iron shield")) {
          inventory.party = inventory.party.filter((i) => i !== "iron shield");
          characterPatch.defense = character.defense + 3;
          resolvedStatus = "success";
          outcome = `You equip the iron shield. Your defense increases by 3! (Defense: ${character.defense + 3})`;
        } else {
          outcome = "You don't have an iron shield.";
          resolvedStatus = "failed";
        }
      } else if (
        target.includes("amulet") ||
        target.includes("amulet of protection")
      ) {
        if (inventory.party.includes("amulet of protection")) {
          inventory.party = inventory.party.filter(
            (i) => i !== "amulet of protection",
          );
          characterPatch.defense = character.defense + 5;
          resolvedStatus = "success";
          outcome = `You wear the amulet of protection. Your defense increases by 5! (Defense: ${character.defense + 5})`;
        } else {
          outcome = "You don't have an amulet of protection.";
          resolvedStatus = "failed";
        }
      } else {
        outcome = `I don't know how to use '${target}'.`;
        resolvedStatus = "rejected";
      }
    }
    // 8. REVIVE
    else if (cleanedAction === "revive") {
      characterPatch.currentHealth = character.health;
      resolvedStatus = "success";
      outcome = `${character.characterName} has been revived and healed to full!`;
      eventDetails = { cheat: "revive" };
    }

    await ctx.db.insert("playerActions", {
      roomId,
      userId: user._id,
      actionText,
      resolvedStatus,
      outcome,
    });

    if (Object.keys(characterPatch).length > 0) {
      await ctx.db.patch(character._id, characterPatch);
    }

    let turnStage = gameState.turnStage;
    let turnIndex = gameState.turnIndex;

    if (resolvedStatus === "success" || resolvedStatus === "failed") {
      if (
        eventType !== "Player Action Attempted" ||
        Object.keys(eventDetails).length > 0
      ) {
        await ctx.db.insert("gameEvents", {
          roomId,
          eventType,
          details: eventDetails,
        });
      }

      const levelUp = eventDetails.levelUp as { message: string } | undefined;
      if (levelUp) {
        await ctx.db.insert("gameEvents", {
          roomId,
          eventType: "Quest Updated",
          details: { message: levelUp.message },
        });
      }

      // Enemy phase
      turnStage = "enemy";
      const mergedCharacter = { ...character, ...characterPatch };

      if (activeMonsters.length > 0) {
        const monster = activeMonsters[0]!;
        const monsterDamage = Math.max(
          1,
          monster.damage - mergedCharacter.defense,
        );
        const newHealth = Math.max(0, mergedCharacter.currentHealth - monsterDamage);
        characterPatch.currentHealth = newHealth;

        await ctx.db.insert("gameEvents", {
          roomId,
          eventType: "Combat Started",
          details: {
            attacker: monster.name,
            damage: monsterDamage,
            target: character.characterName,
          },
        });

        if (newHealth <= 0) {
          await ctx.db.insert("gameEvents", {
            roomId,
            eventType: "Player Died",
            details: {
              character: character.characterName,
              slainBy: monster.name,
            },
          });
        }

        await ctx.db.patch(character._id, { currentHealth: newHealth });
      }

      // World phase
      turnStage = "world";
      const weathers = ["Clear", "Foggy", "Rainy", "Stormy"];
      if (Math.random() < 0.3) {
        weather = weathers[Math.floor(Math.random() * weathers.length)]!;
      }

      const timeParts = currentTime.split(" - ");
      const dayNum = parseInt(timeParts[0]!.split(" ")[1]!, 10);
      const currentTimeStr = timeParts[1]!;
      const times = ["Morning", "Afternoon", "Night"];
      let nextIdx = (times.indexOf(currentTimeStr) + 1) % times.length;
      let newDayNum = dayNum;
      if (nextIdx === 0) newDayNum += 1;
      currentTime = `Day ${newDayNum} - ${times[nextIdx]}`;

      const draftState = {
        ...gameState,
        currentLocation,
        activeMonsters,
        worldFlags,
        currentQuest,
      };
      const newQuest = updateQuest(draftState);
      if (newQuest && newQuest !== currentQuest) {
        currentQuest = newQuest;
        await ctx.db.insert("gameEvents", {
          roomId,
          eventType: "Quest Updated",
          details: { newQuest },
        });
      }

      turnStage = "player";
      turnIndex += 1;
    }

    await ctx.db.patch(gameState._id, {
      currentLocationId,
      currentLocation,
      currentTime,
      weather,
      currentQuest,
      activeNpcs,
      activeMonsters,
      objects,
      inventory,
      worldFlags,
      turnIndex,
      turnStage,
    });

    const updatedGameState = (await ctx.db.get(gameState._id))!;

    if (resolvedStatus === "success" || resolvedStatus === "failed") {
      await ctx.scheduler.runAfter(0, internal.ai.generateNarration, {
        roomId,
        userId: user._id,
      });
    }

    return {
      gameState: updatedGameState,
      outcome,
      resolvedStatus,
    };
  },
});
