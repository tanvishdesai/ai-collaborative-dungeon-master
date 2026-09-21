/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as aiHelpers from "../aiHelpers.js";
import type * as aiProviders from "../aiProviders.js";
import type * as auth from "../auth.js";
import type * as http from "../http.js";
import type * as lib_authHelpers from "../lib/authHelpers.js";
import type * as lib_cascadeDelete from "../lib/cascadeDelete.js";
import type * as lib_rolePresets from "../lib/rolePresets.js";
import type * as personas from "../personas.js";
import type * as profiles from "../profiles.js";
import type * as promptBuilder from "../promptBuilder.js";
import type * as reports from "../reports.js";
import type * as scenarioSeeder from "../scenarioSeeder.js";
import type * as sessionEngine from "../sessionEngine.js";
import type * as sessions from "../sessions.js";
import type * as transcript from "../transcript.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  aiHelpers: typeof aiHelpers;
  aiProviders: typeof aiProviders;
  auth: typeof auth;
  http: typeof http;
  "lib/authHelpers": typeof lib_authHelpers;
  "lib/cascadeDelete": typeof lib_cascadeDelete;
  "lib/rolePresets": typeof lib_rolePresets;
  personas: typeof personas;
  profiles: typeof profiles;
  promptBuilder: typeof promptBuilder;
  reports: typeof reports;
  scenarioSeeder: typeof scenarioSeeder;
  sessionEngine: typeof sessionEngine;
  sessions: typeof sessions;
  transcript: typeof transcript;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
