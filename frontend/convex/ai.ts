"use node";

import { v, ConvexError } from "convex/values";
import { internalAction, action } from "./_generated/server";
import { internal } from "./_generated/api";
import { renderDungeonMasterPrompt } from "./promptBuilder";
import { generateJson } from "./aiProviders";

type AIDungeonMasterResponse = {
  story: string;
  npc_dialogue: string[];
  next_events: string[];
  atmosphere: string;
  suggested_music: string;
};

type AINPCResponse = {
  dialogue: string;
  emotion: string;
  reaction_type: string;
  relationship_change: number;
  rumor: string;
};

const narrationSchema = {
  type: "object",
  properties: {
    story: { type: "string" },
    npc_dialogue: { type: "array", items: { type: "string" } },
    next_events: { type: "array", items: { type: "string" } },
    atmosphere: { type: "string" },
    suggested_music: { type: "string" },
  },
  required: ["story", "atmosphere", "suggested_music"],
};

const npcResponseSchema = {
  type: "object",
  properties: {
    dialogue: { type: "string" },
    emotion: { type: "string" },
    reaction_type: { type: "string" },
    relationship_change: { type: "number" },
    rumor: { type: "string" },
  },
  required: [
    "dialogue",
    "emotion",
    "reaction_type",
    "relationship_change",
    "rumor",
  ],
};

function buildFallbackNarration(context: {
  lastAction: { actionText: string; outcome: string; _creationTime: number };
  gameState: { weather: string; currentTime: string };
  actingCharacterName: string;
  recentEventsObjs: Array<{
    _creationTime: number;
    eventType: string;
    details: unknown;
  }>;
}): string {
  const { lastAction, gameState, actingCharacterName, recentEventsObjs } =
    context;

  const fallbackParts = [
    `${actingCharacterName} attempted to '${lastAction.actionText}'. Resolution: ${lastAction.outcome}.`,
  ];

  for (const ev of recentEventsObjs) {
    if (ev._creationTime >= lastAction._creationTime) {
      const details = ev.details as Record<string, unknown>;
      if (ev.eventType === "Combat Started") {
        fallbackParts.push(
          `Combat round: ${details.attacker} targets ${details.target} dealing ${details.damage} damage.`,
        );
      } else if (ev.eventType === "Quest Updated") {
        fallbackParts.push(
          `The quest progressed: ${details.new_quest ?? details.message}`,
        );
      } else if (ev.eventType === "Player Died") {
        fallbackParts.push(`☠ ${details.character} died.`);
      } else if (ev.eventType === "Item Collected") {
        const items = details.items as string[] | undefined;
        const gold = details.gold as number | undefined;
        const itemsStr = items?.length ? `items: ${items.join(", ")}` : "";
        const goldStr = gold ? `gold: ${gold}` : "";
        fallbackParts.push(`Items were found: ${itemsStr} ${goldStr}`.trim());
      }
    }
  }

  fallbackParts.push(
    `The environment shifts. Weather: ${gameState.weather}, Time: ${gameState.currentTime}.`,
  );

  return fallbackParts.join(" ");
}

export const generateNarration = internalAction({
  args: { roomId: v.id("rooms"), userId: v.id("users") },
  handler: async (ctx, { roomId, userId }) => {
    const context = await ctx.runQuery(internal.aiHelpers.getNarrationContext, {
      roomId,
      userId,
    });

    if (!context) return;

    const fallbackNarration = buildFallbackNarration(context);
    const promptText = renderDungeonMasterPrompt({
      currentLocation: context.gameState.currentLocation,
      currentTime: context.gameState.currentTime,
      weather: context.gameState.weather,
      currentQuest: context.gameState.currentQuest,
      activeNpcs: context.gameState.activeNpcs,
      activeMonsters: context.gameState.activeMonsters,
      objects: context.gameState.objects,
      inventory: context.gameState.inventory,
      worldFlags: context.gameState.worldFlags,
      players: context.playersList,
      lastAction: context.lastAction.actionText,
      actionOutcome: context.lastAction.outcome,
      recentEvents: context.recentEvents,
      storyHistory: context.storyHistory,
    });

    let storyText = `The narrative unfolds. ${fallbackNarration}`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const parsed = (await generateJson(
          promptText,
          0.7,
          narrationSchema,
        )) as AIDungeonMasterResponse;
        if (parsed.story) {
          storyText = parsed.story;
          break;
        }
      } catch {
        if (attempt === 2) break;
      }
    }

    await ctx.runMutation(internal.aiHelpers.persistNarration, {
      roomId,
      entryText: storyText,
    });
  },
});

export const talkToNpc = action({
  args: {
    roomId: v.id("rooms"),
    npcId: v.id("npcs"),
    message: v.string(),
  },
  handler: async (ctx, { roomId, npcId, message }) => {
    const userId = await ctx.runQuery(
      internal.aiHelpers.getAuthenticatedUserId,
      {},
    );
    if (!userId) throw new ConvexError("Not authenticated.");

    const context = await ctx.runQuery(internal.aiHelpers.getNpcTalkContext, {
      roomId,
      npcId,
      userId,
      message,
    });

    if (!context) throw new ConvexError("NPC or character not found.");

    const { npc, character, charName, currentRelationship, recentMemories } =
      context;

    const memoriesStr = recentMemories.length
      ? recentMemories
          .map(
            (m) =>
              `- ${m.characterName}: "${m.playerMessage}" | You: "${m.npcResponse}"`,
          )
          .join("\n")
      : "No prior conversations recorded.";

    const promptText = `You are the AI roleplaying engine acting as the NPC '${npc.name}' in a fantasy adventure text game.
Your details are:
- Race: ${npc.race}
- Profession: ${npc.profession}
- Personality: ${npc.personality}
- Current Mood: ${npc.mood}
- Daily Schedule: ${npc.dailySchedule}
- Goals: ${npc.goals}
- Inventory items you hold: ${JSON.stringify(npc.inventory)}
- Current relationship score with player: ${currentRelationship} (out of 100, where 0 is hostile enemy, 50 is neutral stranger, 100 is loyal friend)

Here is a memory of your previous dialogue exchanges with ${charName}:
${memoriesStr}

${charName} (${character.characterClass}, Level ${character.level}) says to you:
"${message}"

Respond to ${charName} in character! Make your dialogue fit your profession, goals, personality, and relationship.
Provide a change in relationship based on what they said (e.g. positive change if they are respectful or helpful, negative change if they are insulting or threatening).
Return JSON with keys: dialogue (string), emotion (string), reaction_type ("friendly"|"hostile"|"neutral"), relationship_change (number -15..15), rumor (string).
Do not break character.
`;

    const fallback: AINPCResponse = {
      dialogue: `I don't have much to say to you, ${charName}. Move along.`,
      emotion: "Neutral",
      reaction_type: "neutral",
      relationship_change: 0,
      rumor: "",
    };

    let aiObj: AINPCResponse = fallback;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        aiObj = (await generateJson(
          promptText,
          0.8,
          npcResponseSchema,
        )) as AINPCResponse;
        break;
      } catch {
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    }

    const newRelationship = Math.max(
      0,
      Math.min(100, currentRelationship + (aiObj.relationship_change || 0)),
    );

    const relationships = { ...npc.relationships, [charName]: newRelationship };

    await ctx.runMutation(internal.aiHelpers.persistNpcTalk, {
      npcId,
      roomId,
      characterName: charName,
      playerMessage: message,
      npcResponse: aiObj.dialogue,
      rumor: aiObj.rumor || undefined,
      newRelationship,
      newMood: aiObj.emotion,
      relationships,
    });

    return {
      dialogue: aiObj.dialogue,
      emotion: aiObj.emotion,
      relationshipScore: newRelationship,
    };
  },
});
