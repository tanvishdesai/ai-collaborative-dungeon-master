export const CLASS_STARTING_STATS = {
  Warrior: {
    health: 140,
    mana: 20,
    strength: 16,
    intelligence: 6,
    agility: 8,
    defense: 12,
    luck: 8,
    gold: 100,
  },
  Mage: {
    health: 80,
    mana: 150,
    strength: 6,
    intelligence: 18,
    agility: 9,
    defense: 6,
    luck: 10,
    gold: 120,
  },
  Archer: {
    health: 100,
    mana: 40,
    strength: 10,
    intelligence: 10,
    agility: 16,
    defense: 8,
    luck: 14,
    gold: 90,
  },
  Rogue: {
    health: 90,
    mana: 30,
    strength: 9,
    intelligence: 8,
    agility: 18,
    defense: 7,
    luck: 16,
    gold: 150,
  },
  Healer: {
    health: 110,
    mana: 100,
    strength: 8,
    intelligence: 12,
    agility: 10,
    defense: 9,
    luck: 14,
    gold: 110,
  },
} as const;

export type CharacterClass = keyof typeof CLASS_STARTING_STATS;

export const CHARACTER_CLASSES = Object.keys(
  CLASS_STARTING_STATS,
) as CharacterClass[];
