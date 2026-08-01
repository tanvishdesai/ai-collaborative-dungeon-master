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
import type * as auth from "../auth.js";
import type * as characters from "../characters.js";
import type * as gameEngine from "../gameEngine.js";
import type * as http from "../http.js";
import type * as lib_authHelpers from "../lib/authHelpers.js";
import type * as lib_cascadeDelete from "../lib/cascadeDelete.js";
import type * as lib_classPresets from "../lib/classPresets.js";
import type * as lib_sceneHelpers from "../lib/sceneHelpers.js";
import type * as locations from "../locations.js";
import type * as npcs from "../npcs.js";
import type * as promptBuilder from "../promptBuilder.js";
import type * as rooms from "../rooms.js";
import type * as story from "../story.js";
import type * as users from "../users.js";
import type * as worldGenerator from "../worldGenerator.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  aiHelpers: typeof aiHelpers;
  auth: typeof auth;
  characters: typeof characters;
  gameEngine: typeof gameEngine;
  http: typeof http;
  "lib/authHelpers": typeof lib_authHelpers;
  "lib/cascadeDelete": typeof lib_cascadeDelete;
  "lib/classPresets": typeof lib_classPresets;
  "lib/sceneHelpers": typeof lib_sceneHelpers;
  locations: typeof locations;
  npcs: typeof npcs;
  promptBuilder: typeof promptBuilder;
  rooms: typeof rooms;
  story: typeof story;
  users: typeof users;
  worldGenerator: typeof worldGenerator;
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
