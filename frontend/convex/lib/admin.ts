import { ConvexError } from "convex/values";
import { QueryCtx, MutationCtx } from "../_generated/server";
import { requireUser } from "./authHelpers";

// Admins are identified by email. Configure via the ADMIN_EMAILS Convex env var
// (comma-separated); falls back to the project owner when unset.
const DEFAULT_ADMINS = ["tanvishdesai.05@gmail.com"];

function adminEmails(): string[] {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return fromEnv.length ? fromEnv : DEFAULT_ADMINS;
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await requireUser(ctx);
  if (!isAdminEmail(user.email)) {
    throw new ConvexError("Admin access required.");
  }
  return user;
}
