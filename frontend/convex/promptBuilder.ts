export type DungeonMasterPromptInput = {
  currentLocation: string;
  currentTime: string;
  weather: string;
  currentQuest: string;
  activeNpcs: Array<{
    name: string;
    type?: string;
    status?: string;
    health?: number;
    dialogue?: string;
  }>;
  activeMonsters: Array<{
    name: string;
    health: number;
    maxHealth: number;
    damage: number;
    defense: number;
  }>;
  objects: Array<{
    name: string;
    type?: string;
    status?: string;
  }>;
  inventory: { party: string[] };
  worldFlags: {
    visitedLocations: string[];
    completedQuests: string[];
    killedMonsters: string[];
    openedChests: string[];
    destroyedObjects: string[];
    npcRelationships: Record<string, number>;
  };
  players: Array<{
    name: string;
    class: string;
    level: number;
    hp: number;
    maxHp: number;
    mana: number;
    maxMana: number;
  }>;
  lastAction: string;
  actionOutcome: string;
  recentEvents: Array<{ eventType: string; details: unknown }>;
  storyHistory: string[];
};

export function renderDungeonMasterPrompt(
  input: DungeonMasterPromptInput,
): string {
  const playersStr = input.players
    .map(
      (p) =>
        `- ${p.name} (${p.class}, Level ${p.level}): HP ${p.hp}/${p.maxHp}, MP ${p.mana}/${p.maxMana}`,
    )
    .join("\n");

  const npcsStr = input.activeNpcs.length
    ? input.activeNpcs
        .map(
          (n) =>
            `- ${n.name} (${n.type ?? "NPC"}): Status: ${n.status ?? "Neutral"}, HP: ${n.health ?? 100}/100. Dialogue clue: "${n.dialogue ?? ""}"`,
        )
        .join("\n")
    : "No active NPCs in this location.";

  const monstersStr = input.activeMonsters.length
    ? input.activeMonsters
        .map(
          (m) =>
            `- ${m.name}: HP ${m.health}/${m.maxHealth}, Damage: ${m.damage}, Defense: ${m.defense}`,
        )
        .join("\n")
    : "No active monsters in this location.";

  const objectsStr = input.objects.length
    ? input.objects
        .map(
          (o) =>
            `- ${o.name} (${o.type ?? "Object"}): Status: ${o.status ?? "Neutral"}`,
        )
        .join("\n")
    : "No active objects in this location.";

  const recentEventsStr = input.recentEvents.length
    ? input.recentEvents
        .map((e) => `- Event: ${e.eventType} | Details: ${JSON.stringify(e.details)}`)
        .join("\n")
    : "No recent events.";

  const historyStr = input.storyHistory.length
    ? input.storyHistory
        .map((entry, idx) => `Event ${idx + 1}: ${entry}`)
        .join("\n")
    : "No prior history.";

  const partyInv = input.inventory.party.length
    ? input.inventory.party.join(", ")
    : "Empty";

  return `You are the AI Dungeon Master for a collaborative fantasy text-adventure game.
Your role is strictly to narrate the outcome of player actions, describe the environment/weather changes, write NPC dialogue, and depict combat rounds.

CRITICAL INSTRUCTIONS:
1. DO NOT CALCULATE GAME RULES, DAMAGE, OR HEALTH CHANGES. The game engine has already processed the action and calculated the outcome.
2. DO NOT MODIFY INVENTORY or grant items.
3. Simply NARRATE the outcome and expansion of the story based on the provided engine outcome.
4. Your story narration must be immersive, rich, descriptive, and highly engaging.

=== CONTEXT ===
Current Location: ${input.currentLocation}
Current Time: ${input.currentTime}
Current Weather: ${input.weather}
Current Quest: ${input.currentQuest}

Active Players:
${playersStr}

Party Inventory:
${partyInv}

Active NPCs:
${npcsStr}

Active Monsters:
${monstersStr}

Objects in Area:
${objectsStr}

World Flags & History:
- Visited Places: ${JSON.stringify(input.worldFlags.visitedLocations)}
- Completed Quests: ${JSON.stringify(input.worldFlags.completedQuests)}
- NPC Relationships: ${JSON.stringify(input.worldFlags.npcRelationships)}

Recent System Events:
${recentEventsStr}

Recent Story Memory (Last 10-20 Events):
${historyStr}

=== LAST ACTION RESOLVED BY GAME ENGINE ===
Player action request: "${input.lastAction}"
Engine Outcome: ${input.actionOutcome}

Generate the next narration based on the Engine Outcome. Ensure the narration fits the story memory, weather transitions, and room descriptions.
`;
}
