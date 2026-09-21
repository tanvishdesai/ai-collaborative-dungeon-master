// Domain presets for the placement-practice simulator: target roles, experience
// levels, the AI interviewer panel, the GD moderator, and the scoring rubrics.
// Kept in code (not a DB table) — these are fixed reference data, not per-session.

export const TARGET_ROLES = [
  "Software Engineer",
  "Data Analyst",
  "Product Manager",
  "Business Analyst",
  "Marketing Associate",
  "Consultant",
  "Mechanical Engineer",
  "Core / Non-IT Role",
  "General / Other",
] as const;
export type TargetRole = (typeof TARGET_ROLES)[number];

export const EXPERIENCE_LEVELS = [
  "Student",
  "Fresher",
  "1-3 years",
  "3+ years",
] as const;
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type PersonaPreset = {
  name: string;
  personaRole: string;
  personality: string;
  focusAreas: string;
  strictness: number; // 1 (gentle) .. 5 (tough)
  avatar: string;
  goals: string;
};

// The AI interview panel. Multiple personas = the "panel" no single-player tool
// simulates. Rotated through across an interview.
export const INTERVIEW_PANEL: PersonaPreset[] = [
  {
    name: "Priya Sharma",
    personaRole: "HR Manager",
    personality:
      "Warm but perceptive. Reads between the lines and probes motivation, self-awareness, and culture fit.",
    focusAreas: "Motivation, teamwork, communication, behavioural (STAR)",
    strictness: 2,
    avatar: "hr",
    goals: "Assess attitude, self-awareness, and whether the candidate fits.",
  },
  {
    name: "Arjun Mehta",
    personaRole: "Technical Lead",
    personality:
      "Direct and detail-oriented. Cares less about buzzwords and more about how you reason and your fundamentals.",
    focusAreas: "Role-specific technical depth, problem solving, fundamentals",
    strictness: 4,
    avatar: "tech",
    goals: "Assess technical competence and clarity of reasoning.",
  },
  {
    name: "Rohan Verma",
    personaRole: "Senior Manager",
    personality:
      "Calm and skeptical. Asks pointed follow-ups and gently challenges weak or vague answers to test composure.",
    focusAreas: "Ownership, decision-making, handling pressure",
    strictness: 5,
    avatar: "stress",
    goals: "Test composure, depth, and honesty under follow-up pressure.",
  },
];

export const GD_MODERATOR: PersonaPreset = {
  name: "Neha Kapoor",
  personaRole: "Group Discussion Moderator",
  personality:
    "A neutral, professional facilitator who keeps the discussion balanced, on-topic, and gives everyone a fair chance.",
  focusAreas: "Facilitation, fairness, structure",
  strictness: 3,
  avatar: "mod",
  goals: "Run a fair, structured group discussion and assess each participant.",
};

// Scoring rubrics. The final feedback report scores each competency 1-5.
export const INTERVIEW_COMPETENCIES = [
  "Communication",
  "Technical / Domain Depth",
  "Structure & Clarity",
  "Confidence & Composure",
  "Relevance & Examples",
] as const;

export const GD_COMPETENCIES = [
  "Content Quality",
  "Communication",
  "Initiative & Leadership",
  "Active Listening",
  "Collaboration",
] as const;

export function rubricFor(mode: "panel_interview" | "group_discussion"): string[] {
  return mode === "panel_interview"
    ? [...INTERVIEW_COMPETENCIES]
    : [...GD_COMPETENCIES];
}

// Difficulty → base level (1-3). The engine escalates from here as the session
// progresses, so a "hard" session ramps faster and higher.
export const DIFFICULTY_BASE: Record<Difficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

export const DIFFICULTY_LABELS = ["warm-up", "standard", "probing", "demanding"];
