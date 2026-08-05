import { internalMutation } from "./_generated/server";

/**
 * One-off migration: strip the deprecated character stats (mana, currentMana,
 * intelligence, agility, luck) from any existing character rows created under
 * the old schema. Combat only ever used strength, defense and health, so these
 * fields were removed from the game.
 *
 * Run once after pushing the new schema:
 *   npx convex run migrations:dropDeprecatedCharacterFields
 *
 * It is safe to run multiple times (already-clean rows are skipped) and safe to
 * run on an empty table (cleans 0 rows). Once every row is clean, the optional
 * `mana`/`currentMana`/`intelligence`/`agility`/`luck` fields can be deleted
 * from the `characters` table in schema.ts.
 */
export const dropDeprecatedCharacterFields = internalMutation({
  args: {},
  handler: async (ctx) => {
    const characters = await ctx.db.query("characters").collect();

    let cleaned = 0;
    for (const c of characters) {
      const hasDeprecated =
        c.mana !== undefined ||
        c.currentMana !== undefined ||
        c.intelligence !== undefined ||
        c.agility !== undefined ||
        c.luck !== undefined;

      if (hasDeprecated) {
        // Setting a field to `undefined` in a patch removes it from the doc.
        await ctx.db.patch(c._id, {
          mana: undefined,
          currentMana: undefined,
          intelligence: undefined,
          agility: undefined,
          luck: undefined,
        });
        cleaned++;
      }
    }

    return { totalCharacters: characters.length, cleaned };
  },
});
