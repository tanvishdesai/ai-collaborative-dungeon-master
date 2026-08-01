import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";

const USERNAME_RE = /^[A-Za-z0-9_]+$/;

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Must be synchronous — Password.js does not await profile().
      profile(params) {
        const email = String(params.email ?? "")
          .trim()
          .toLowerCase();
        if (!email || !email.includes("@")) {
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

        return { email, username, isActive: true };
      },
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
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        return args.existingUserId;
      }

      const email =
        typeof args.profile.email === "string"
          ? args.profile.email.trim().toLowerCase()
          : undefined;
      const username =
        typeof args.profile.username === "string"
          ? args.profile.username.trim()
          : undefined;

      if (email) {
        const existingEmail = await ctx.db
          .query("users")
          .withIndex("email", (q) => q.eq("email", email))
          .unique();
        if (existingEmail) {
          throw new ConvexError("An account with this email already exists.");
        }
      }

      if (username) {
        const existingUsername = await ctx.db
          .query("users")
          .withIndex("by_username", (q) => q.eq("username", username))
          .unique();
        if (existingUsername) {
          throw new ConvexError("This username is already taken.");
        }
      }

      return await ctx.db.insert("users", {
        email,
        username,
        isActive: true,
      });
    },
  },
});
