"use client";

import React, { useState } from "react";
import {
  Shield,
  Wand2,
  Swords,
  Flame,
  Heart,
  Skull,
  Crown,
  Ghost,
  Sparkles,
  Target,
  Music,
  Compass,
  Sun,
  Leaf,
  FlaskConical,
  Loader2,
  Dices,
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  CLASS_STARTING_STATS,
  CHARACTER_CLASSES,
  type CharacterClass,
} from "@/convex/lib/classPresets";
import { Button } from "@/components/ui/button";
import { authErrorMessage } from "@/hooks/use-auth";

interface CharacterCreationProps {
  roomCode: string;
  onCreated: () => void;
}

const CLASS_DESCRIPTIONS: Record<CharacterClass, string> = {
  Warrior:
    "A mighty champion of strength and defense. Thrives in the heat of battle with high health and devastating melee power.",
  Mage:
    "A master of the arcane arts. Commands overwhelming mana and intelligence to launch devastating spells, though physically vulnerable.",
  Archer:
    "A swift and precise marksman. High agility and critical strike potential allow them to take down foes from a safe distance.",
  Rogue:
    "A master of stealth and fortune. Incredible speed and luck let them strike swiftly, evade attacks, and find hidden riches.",
  Healer:
    "A devoted protector and support. Wields powerful restorative magic with high mana and healing bonuses to sustain the party.",
};

export const AVATARS = [
  { id: "avatar_1", name: "Shieldmaiden", gradient: "from-amber-600 to-yellow-800", Icon: Shield },
  { id: "avatar_2", name: "Shadow Weaver", gradient: "from-purple-600 to-indigo-800", Icon: Wand2 },
  { id: "avatar_3", name: "Gladiator", gradient: "from-red-600 to-rose-900", Icon: Swords },
  { id: "avatar_4", name: "Pyromancer", gradient: "from-orange-500 to-red-700", Icon: Flame },
  { id: "avatar_5", name: "Holy Cleric", gradient: "from-pink-500 to-rose-600", Icon: Heart },
  { id: "avatar_6", name: "Necromancer", gradient: "from-slate-700 to-zinc-900", Icon: Skull },
  { id: "avatar_7", name: "Rune Knight", gradient: "from-yellow-500 to-amber-700", Icon: Crown },
  { id: "avatar_8", name: "Plague Doctor", gradient: "from-cyan-600 to-blue-800", Icon: Ghost },
  { id: "avatar_9", name: "Archmage", gradient: "from-indigo-500 to-purple-700", Icon: Sparkles },
  { id: "avatar_10", name: "Assassin", gradient: "from-emerald-600 to-teal-800", Icon: Target },
  { id: "avatar_11", name: "Bard of Lore", gradient: "from-fuchsia-500 to-pink-700", Icon: Music },
  { id: "avatar_12", name: "Elven Ranger", gradient: "from-lime-600 to-green-800", Icon: Compass },
  { id: "avatar_13", name: "Monk of Light", gradient: "from-yellow-400 to-orange-600", Icon: Sun },
  { id: "avatar_14", name: "Druid of Wilds", gradient: "from-green-500 to-emerald-700", Icon: Leaf },
  { id: "avatar_15", name: "Alchemist", gradient: "from-blue-500 to-cyan-700", Icon: FlaskConical },
];

export default function CharacterCreation({ roomCode, onCreated }: CharacterCreationProps) {
  const createCharacter = useMutation(api.characters.create);
  const [characterName, setCharacterName] = useState("");
  const [selectedClass, setSelectedClass] = useState<CharacterClass>("Warrior");
  const [selectedAvatar, setSelectedAvatar] = useState("avatar_1");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeStats = CLASS_STARTING_STATS[selectedClass];
  const activeDescription = CLASS_DESCRIPTIONS[selectedClass];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!characterName.trim()) {
      setError("Character name is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await createCharacter({
        roomCode,
        characterName: characterName.trim(),
        characterClass: selectedClass,
        avatar: selectedAvatar,
      });
      onCreated();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateRandomName = () => {
    const prefixes = ["Thorin", "Eldrin", "Lyra", "Gideon", "Valerie", "Zephyr", "Riona", "Kaelen", "Freya", "Bram", "Sylas", "Morrigan"];
    const suffixes = ["Oakshield", "Stormweaver", "Swiftbow", "Ironclad", "Sunweaver", "Shadowwhisper", "Goldhand", "Dawnwarden"];
    const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    setCharacterName(`${randomPrefix} ${randomSuffix}`);
  };

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-border bg-card/85 p-6 shadow-glow backdrop-blur-md">
      <div className="border-b border-border pb-4">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Create Your Character</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Forge your hero before joining the adventure. Choose class and stats wisely.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {error && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="characterName" className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            Character Name
          </label>
          <div className="flex gap-2">
            <input
              id="characterName"
              type="text"
              placeholder="Enter hero name..."
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              className="flex-1 rounded-md border border-border bg-background/50 px-4 py-2 text-foreground focus:border-primary focus:outline-none"
              maxLength={100}
              disabled={isSubmitting}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={generateRandomName}
              disabled={isSubmitting}
              title="Generate Random Name"
              className="px-3"
            >
              <Dices className="h-4 w-4 mr-1.5" />
              Random
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-[1fr_0.8fr]">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                Choose Class
              </span>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {CHARACTER_CLASSES.map((className) => {
                  const isSelected = selectedClass === className;
                  return (
                    <button
                      key={className}
                      type="button"
                      onClick={() => setSelectedClass(className)}
                      disabled={isSubmitting}
                      className={`flex flex-col items-center justify-center gap-2 rounded-md border p-4 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-glow"
                          : "border-border bg-background/40 hover:border-border/80"
                      }`}
                    >
                      <span className="font-semibold text-foreground text-sm sm:text-base">{className}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
                Choose Avatar
              </span>
              <div className="grid grid-cols-5 gap-2 rounded-lg bg-background/30 p-3 border border-border">
                {AVATARS.map((avatar) => {
                  const AvatarIcon = avatar.Icon;
                  const isSelected = selectedAvatar === avatar.id;

                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => setSelectedAvatar(avatar.id)}
                      disabled={isSubmitting}
                      title={avatar.name}
                      className={`relative flex aspect-square items-center justify-center rounded-full bg-gradient-to-br text-white shadow-md transition-transform active:scale-95 ${
                        avatar.gradient
                      } ${isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-card" : "hover:brightness-110"}`}
                    >
                      <AvatarIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-lg border border-border bg-background/40 p-4">
            <div>
              <h3 className="text-base font-semibold text-primary">{selectedClass} Preview</h3>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{activeDescription}</p>
            </div>

            <div className="border-t border-border pt-3">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Starting Stats
              </span>
              <div className="mt-3 space-y-2 text-xs sm:text-sm">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Health</span>
                    <span className="font-semibold text-rose-400">{activeStats.health}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (activeStats.health / 150) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mana</span>
                    <span className="font-semibold text-blue-400">{activeStats.mana}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (activeStats.mana / 150) * 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/40 pt-3">
                  <div className="flex justify-between border-b border-border/20 pb-1">
                    <span className="text-muted-foreground text-xs">Strength</span>
                    <span className="font-semibold text-foreground">{activeStats.strength}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/20 pb-1">
                    <span className="text-muted-foreground text-xs">Agility</span>
                    <span className="font-semibold text-foreground">{activeStats.agility}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/20 pb-1">
                    <span className="text-muted-foreground text-xs">Intelligence</span>
                    <span className="font-semibold text-foreground">{activeStats.intelligence}</span>
                  </div>
                  <div className="flex justify-between border-b border-border/20 pb-1">
                    <span className="text-muted-foreground text-xs">Defense</span>
                    <span className="font-semibold text-foreground">{activeStats.defense}</span>
                  </div>
                  <div className="flex justify-between col-span-2">
                    <span className="text-muted-foreground text-xs">Luck</span>
                    <span className="font-semibold text-foreground">{activeStats.luck}</span>
                  </div>
                </div>

                <div className="flex justify-between border-t border-border/40 pt-3 text-xs sm:text-sm font-semibold">
                  <span className="text-amber-500">Starting Gold</span>
                  <span className="text-amber-400">{activeStats.gold}g</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Button
          type="submit"
          className="w-full bg-primary text-primary-foreground font-bold hover:bg-primary/95 text-base py-5 tracking-wide shadow-lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Forging Character...
            </>
          ) : (
            "Create Character"
          )}
        </Button>
      </form>
    </div>
  );
}
