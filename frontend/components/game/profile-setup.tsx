"use client";

import React, { useState } from "react";
import {
  User,
  GraduationCap,
  Code2,
  BarChart3,
  Briefcase,
  PenTool,
  Wrench,
  Lightbulb,
  Loader2,
} from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { TARGET_ROLES, EXPERIENCE_LEVELS } from "@/convex/lib/rolePresets";
import { Button } from "@/components/ui/button";
import { authErrorMessage } from "@/hooks/use-auth";

export const AVATARS = [
  { id: "a1", gradient: "from-indigo-500 to-violet-600", Icon: User },
  { id: "a2", gradient: "from-sky-500 to-blue-600", Icon: GraduationCap },
  { id: "a3", gradient: "from-emerald-500 to-teal-600", Icon: Code2 },
  { id: "a4", gradient: "from-amber-500 to-orange-600", Icon: BarChart3 },
  { id: "a5", gradient: "from-rose-500 to-pink-600", Icon: Briefcase },
  { id: "a6", gradient: "from-fuchsia-500 to-purple-600", Icon: PenTool },
  { id: "a7", gradient: "from-cyan-500 to-sky-600", Icon: Wrench },
  { id: "a8", gradient: "from-lime-500 to-green-600", Icon: Lightbulb },
];

interface ProfileSetupProps {
  sessionCode: string;
  defaultRole?: string;
  isCandidate: boolean;
  onCreated: () => void;
}

export default function ProfileSetup({
  sessionCode,
  defaultRole,
  isCandidate,
  onCreated,
}: ProfileSetupProps) {
  const createProfile = useMutation(api.profiles.create);
  const [displayName, setDisplayName] = useState("");
  const [targetRole, setTargetRole] = useState(defaultRole || TARGET_ROLES[0]);
  const [experienceLevel, setExperienceLevel] = useState<string>(EXPERIENCE_LEVELS[0]);
  const [background, setBackground] = useState("");
  const [avatar, setAvatar] = useState("a1");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Your name is required.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await createProfile({
        sessionCode,
        displayName: displayName.trim(),
        targetRole,
        experienceLevel,
        background,
        avatar,
      });
      onCreated();
    } catch (err) {
      setError(authErrorMessage(err));
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card/80 p-6 shadow-glow">
      <div className="border-b border-border pb-4">
        <h2 className="text-xl font-semibold text-foreground">Set up your profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isCandidate
            ? "The panel uses this to tailor questions to you — like a real interviewer reading your résumé."
            : "Tell the group who you are before the discussion begins."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-5">
        {error && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Your name
            </span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Ananya Rao"
              maxLength={60}
              disabled={isSubmitting}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Target role
            </span>
            <select
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              disabled={isSubmitting}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              {TARGET_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Experience level
            </span>
            <select
              value={experienceLevel}
              onChange={(e) => setExperienceLevel(e.target.value)}
              disabled={isSubmitting}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
            >
              {EXPERIENCE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Avatar
            </span>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map((av) => {
                const Icon = av.Icon;
                const selected = avatar === av.id;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => setAvatar(av.id)}
                    disabled={isSubmitting}
                    className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-white transition ${av.gradient} ${
                      selected
                        ? "ring-2 ring-primary ring-offset-2 ring-offset-card"
                        : "opacity-70 hover:opacity-100"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Background / résumé summary
          </span>
          <textarea
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            placeholder="A few lines: key skills, projects, internships. The interviewer will draw on this."
            rows={3}
            maxLength={600}
            disabled={isSubmitting}
            className="resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
          />
        </label>

        <Button type="submit" disabled={isSubmitting} className="w-full py-5">
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : (
            "Save profile"
          )}
        </Button>
      </form>
    </div>
  );
}
