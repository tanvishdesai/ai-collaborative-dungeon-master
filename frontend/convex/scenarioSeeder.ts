import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { INTERVIEW_PANEL, GD_MODERATOR } from "./lib/rolePresets";

// Seeds the AI personas for a session: the interviewer panel for a panel
// interview, or a single moderator for a group discussion.
export const seedPersonas = internalMutation({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, { sessionId }) => {
    const session = await ctx.db.get(sessionId);
    if (!session) throw new Error("Session not found.");

    const presets =
      session.mode === "panel_interview" ? INTERVIEW_PANEL : [GD_MODERATOR];

    const personaIds = [];
    for (const p of presets) {
      const id = await ctx.db.insert("personas", {
        sessionId,
        name: p.name,
        personaRole: p.personaRole,
        personality: p.personality,
        focusAreas: p.focusAreas,
        strictness: p.strictness,
        avatar: p.avatar,
        mood: "Composed",
        goals: p.goals,
      });
      personaIds.push(id);
    }
    return personaIds;
  },
});
