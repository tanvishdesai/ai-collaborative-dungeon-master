import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";

const USERNAME_RE = /^[A-Za-z0-9_]+$/;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Password.profile typings omit Promise; runtime awaits the result.
      profile: (async (
        params: Record<string, unknown>,
        ctx: { runQuery: (ref: unknown, args: unknown) => Promise<unknown> },
      ) => {
        const email = String(params.email ?? "")
          .trim()
          .toLowerCase();
        if (!email) {
          throw new ConvexError("Email is required.");
        }

        if (params.flow !== "signUp") {
          return { email };
        }

        const username = String(params.username ?? "").trim();
        if (
          username.length < 3 ||
          username.length > 32 ||
          !USERNAME_RE.test(username)
        ) {
          throw new ConvexError(
            "Username must be 3-32 characters and use only letters, numbers, or underscores.",
          );
        }

        if (await ctx.runQuery(internal.users.usernameTaken, { username })) {
          throw new ConvexError("This username is already taken.");
        }
        if (await ctx.runQuery(internal.users.emailTaken, { email })) {
          throw new ConvexError("An account with this email already exists.");
        }

        return { email, username, isActive: true };
      }) as never,
      validatePasswordRequirements: (password: string) => {
        if (password.length < 8 || password.length > 128) {
          throw new ConvexError(
            "Password must be between 8 and 128 characters.",
          );
        }
        if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
          throw new ConvexError(
            "Password must include at least one letter and one number.",
          );
        }
      },
    }),
  ],
});
