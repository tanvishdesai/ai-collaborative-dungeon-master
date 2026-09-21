import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export async function deleteSessionCascade(
  ctx: MutationCtx,
  sessionId: Id<"sessions">,
) {
  const personas = await ctx.db
    .query("personas")
    .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
    .collect();
  for (const persona of personas) {
    const memories = await ctx.db
      .query("personaMemories")
      .withIndex("by_persona", (q) => q.eq("personaId", persona._id))
      .collect();
    for (const memory of memories) await ctx.db.delete(memory._id);
    await ctx.db.delete(persona._id);
  }

  const tables = [
    "participants",
    "profiles",
    "sessionState",
    "transcript",
    "responses",
    "feedbackReports",
  ] as const;

  for (const table of tables) {
    const rows = await ctx.db
      .query(table)
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }

  await ctx.db.delete(sessionId);
}
