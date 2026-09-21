// Prompt builders. The LLM is confined to producing interviewer questions,
// moderator prompts, and feedback prose — it never decides who speaks next,
// scoring order, or session flow. That stays in the deterministic engine.

const DIFFICULTY_GUIDANCE: Record<number, string> = {
  1: "Keep it approachable — a warm-up question. Do not pile on follow-ups.",
  2: "A standard question at the level expected for this role.",
  3: "A probing question. If the last answer was vague or generic, challenge it directly and ask for specifics.",
};

type TranscriptLine = { speakerName: string; speakerRole?: string; text: string };
type MemoryLine = { question: string; answer: string };

function renderTranscript(lines: TranscriptLine[]): string {
  if (!lines.length) return "This is the start of the session.";
  return lines
    .map((l) => `${l.speakerName}${l.speakerRole ? ` (${l.speakerRole})` : ""}: ${l.text}`)
    .join("\n");
}

export type InterviewerPromptInput = {
  persona: { name: string; personaRole: string; personality: string; focusAreas: string; strictness: number };
  candidate: { displayName: string; targetRole: string; experienceLevel: string; background: string; resumeText?: string };
  session: { targetRole: string; difficulty: string };
  targetCompetency: string;
  difficultyLevel: number;
  questionIndex: number;
  totalQuestions: number;
  recentTranscript: TranscriptLine[];
  personaMemory: MemoryLine[];
};

export function renderInterviewerPrompt(input: InterviewerPromptInput): string {
  const {
    persona,
    candidate,
    session,
    targetCompetency,
    difficultyLevel,
    questionIndex,
    totalQuestions,
    recentTranscript,
    personaMemory,
  } = input;

  const memoryStr = personaMemory.length
    ? personaMemory
        .map((m) => `- You asked: "${m.question}" → ${candidate.displayName} answered: "${m.answer}"`)
        .join("\n")
    : "No earlier exchanges with this candidate yet.";

  const isFirst = questionIndex === 0;
  const isLast = questionIndex >= totalQuestions - 1;

  return `You are ${persona.name}, a ${persona.personaRole} on the interview panel for a campus placement mock interview.
Your personality: ${persona.personality}
You focus on: ${persona.focusAreas}
Your strictness (1 gentle, 5 tough): ${persona.strictness}.

You are interviewing ${candidate.displayName}, applying for the role of "${session.targetRole || candidate.targetRole}".
Candidate background: experience level = ${candidate.experienceLevel}. Notes: ${candidate.background || "None provided."}
${candidate.resumeText ? `
The candidate uploaded their résumé. Ground your questions in its real specifics — named projects, skills, tools, companies, achievements, and any gaps. Prefer probing what's actually written here over generic questions:
"""
${candidate.resumeText}
"""
` : ""}
This is question ${questionIndex + 1} of ${totalQuestions}. Session difficulty: ${session.difficulty}.
${DIFFICULTY_GUIDANCE[difficultyLevel] ?? DIFFICULTY_GUIDANCE[2]}
The competency this question should assess: ${targetCompetency}.

Your memory of this candidate's earlier answers:
${memoryStr}

Recent conversation:
${renderTranscript(recentTranscript)}

INSTRUCTIONS:
- ${isFirst ? "Open warmly: a one-line greeting, then your first question." : "If the candidate's last answer was weak, vague, or interesting, briefly react or probe it in one sentence (this is what makes you feel real) — then ask your question."}
- Ask exactly ONE clear question that assesses "${targetCompetency}" for a ${session.targetRole || candidate.targetRole} role.
- Speak naturally as a real interviewer in an Indian campus placement setting. Professional, human, concise. Do NOT answer for the candidate or coach them.
${isLast ? "- This is the final question — you may frame it as a closing question." : ""}

Return JSON:
- "reaction": string — a short (0-2 sentence) in-character reaction to the previous answer, or "" if this is the first question.
- "question": string — the single question you ask now (do not include the reaction text again).`;
}

export type ModeratorPromptInput = {
  topic: string;
  round: number;
  totalRounds: number;
  discussants: string[];
  recentTranscript: TranscriptLine[];
};

export function renderModeratorPrompt(input: ModeratorPromptInput): string {
  const { topic, round, totalRounds, discussants, recentTranscript } = input;
  const isFirst = round === 0;

  return `You are Neha Kapoor, a neutral, professional Group Discussion moderator for a campus placement practice.
The GD topic is: "${topic}".
Participants: ${discussants.join(", ")}.
This is round ${round + 1} of ${totalRounds}.

Recent discussion:
${renderTranscript(recentTranscript)}

INSTRUCTIONS:
- ${isFirst ? "Open the discussion: state the topic clearly and invite the group to begin. Keep it to 2-3 sentences." : "Briefly summarise where the discussion stands in one sentence, then steer it forward — introduce a sub-angle or gently invite quieter participants to respond."}
- Stay neutral. Do NOT take a side or give your own opinion on the topic. Do NOT score anyone here.
- Keep it short and facilitative.

Return JSON:
- "reaction": string — "" for the first round, otherwise a one-sentence summary of the discussion so far.
- "question": string — your facilitation prompt / steer for this round.`;
}

export type FeedbackPromptInput = {
  mode: "panel_interview" | "group_discussion";
  participantName: string;
  targetRole: string;
  topic: string;
  competencies: string[];
  exchanges: Array<{ prompt: string; answer: string }>;
};

export function renderFeedbackPrompt(input: FeedbackPromptInput): string {
  const { mode, participantName, targetRole, topic, competencies, exchanges } = input;

  const exchangesStr = exchanges.length
    ? exchanges
        .map((e, i) => `Q${i + 1}: ${e.prompt}\n${participantName}'s answer: ${e.answer}`)
        .join("\n\n")
    : "The participant did not provide any substantive answers.";

  const context =
    mode === "panel_interview"
      ? `a mock panel interview for the role of "${targetRole}"`
      : `a group discussion on the topic "${topic}"`;

  return `You are an expert placement trainer writing an honest, constructive assessment of ${participantName}'s performance in ${context}.

Here is everything ${participantName} said, with the prompts they responded to:

${exchangesStr}

Score the following competencies, each from 1 (poor) to 5 (excellent), based ONLY on the answers above. Be fair but honest — do not inflate scores. If the participant barely engaged, say so and score low.

Competencies to score (use these exact names):
${competencies.map((c) => `- ${c}`).join("\n")}

Return JSON:
- "overallScore": number 0-100 — an overall readiness score.
- "competencies": array of { "name": string (exactly one of the names above), "score": number 1-5, "justification": string (1 sentence, specific to what they said) }. Include every competency listed.
- "strengths": array of 2-3 short, specific strings.
- "improvements": array of 2-3 short, specific, actionable strings.
- "summary": string — 2-3 sentences of overall feedback addressed to ${participantName}.`;
}
