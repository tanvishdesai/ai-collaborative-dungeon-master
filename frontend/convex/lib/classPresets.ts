export const CLASS_STARTING_STATS = {
  Warrior: {
    health: 140,
    strength: 16,
    defense: 12,
    gold: 100,
  },
  Mage: {
    health: 80,
    strength: 12,
    defense: 6,
    gold: 120,
  },
  Archer: {
    health: 100,
    strength: 14,
    defense: 8,
    gold: 90,
  },
  Rogue: {
    health: 90,
    strength: 13,
    defense: 7,
    gold: 150,
  },
  Healer: {
    health: 110,
    strength: 10,
    defense: 9,
    gold: 110,
  },
} as const;

export type CharacterClass = keyof typeof CLASS_STARTING_STATS;

export const CHARACTER_CLASSES = Object.keys(
  CLASS_STARTING_STATS,
) as CharacterClass[];
