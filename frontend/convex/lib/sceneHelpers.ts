import { Doc } from "../_generated/dataModel";

type SceneNpc = {
  name: string;
  type: string;
  health: number;
  status: string;
  dialogue: string;
};

type SceneObject = {
  name: string;
  type: string;
  status: string;
  items?: string[];
  gold?: number;
  requires?: string;
  leadsTo?: string;
};

type NpcListEntry = { name: string; dialogue: string };

export function flattenWorldObject(
  obj: Pick<Doc<"worldObjects">, "name" | "type" | "status" | "details">,
): SceneObject {
  const details = (obj.details ?? {}) as Record<string, unknown>;
  const result: SceneObject = {
    name: obj.name,
    type: obj.type,
    status: obj.status,
  };
  if (Array.isArray(details.items)) {
    result.items = details.items as string[];
  }
  if (typeof details.gold === "number") {
    result.gold = details.gold;
  }
  if (typeof details.requires === "string") {
    result.requires = details.requires;
  }
  if (typeof details.leadsTo === "string") {
    result.leadsTo = details.leadsTo;
  }
  return result;
}

export function npcListToSceneNpcs(npcList: NpcListEntry[]): SceneNpc[] {
  return npcList.map((npc) => ({
    name: npc.name,
    type: "villager",
    health: 100,
    status: "friendly",
    dialogue: npc.dialogue,
  }));
}

export function persistentNpcToSceneNpc(
  npc: Pick<Doc<"npcs">, "name" | "profession" | "personality">,
): SceneNpc {
  return {
    name: npc.name,
    type: npc.profession,
    health: 100,
    status: "friendly",
    dialogue:
      npc.personality ||
      `Greetings, traveler. I am ${npc.name}, the ${npc.profession.toLowerCase()}.`,
  };
}

export type { SceneNpc, SceneObject };
