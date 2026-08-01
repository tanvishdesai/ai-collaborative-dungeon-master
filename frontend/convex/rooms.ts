import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requireUser, requireRoomByCode } from "./lib/authHelpers";
import { deleteRoomCascade } from "./lib/cascadeDelete";
import {
  npcListToSceneNpcs,
  persistentNpcToSceneNpc,
} from "./lib/sceneHelpers";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const MAX_ROOM_CODE_ATTEMPTS = 10;
const MAX_ROOM_PLAYERS = 6;

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[
      Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)
    ];
  }
  return code;
}

async function buildRoomPayload(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"rooms">,
  currentUserId: Id<"users">,
) {
  const room = (await ctx.db.get(roomId))!;

  const host = await ctx.db.get(room.hostUserId);

  const roomPlayers = await ctx.db
    .query("roomPlayers")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();

  const players = await Promise.all(
    roomPlayers.map(async (rp) => {
      const user = await ctx.db.get(rp.userId);
      const character = await ctx.db
        .query("characters")
        .withIndex("by_room_and_user", (q) =>
          q.eq("roomId", roomId).eq("userId", rp.userId),
        )
        .unique();
      return {
        ...rp,
        user: user
          ? {
              id: user._id,
              username: user.username ?? "",
              email: user.email ?? "",
            }
          : null,
        character,
      };
    }),
  );

  const membership = roomPlayers.find((p) => p.userId === currentUserId);

  return {
    room,
    host: host
      ? {
          id: host._id,
          username: host.username ?? "",
          email: host.email ?? "",
        }
      : null,
    players,
    currentUserRole: membership?.role ?? null,
  };
}

export const create = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt++) {
      const code = generateRoomCode();
      const existing = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique();

      if (existing) continue;

      const roomId = await ctx.db.insert("rooms", {
        code,
        hostUserId: user._id,
        status: "waiting",
      });

      await ctx.db.insert("roomPlayers", {
        roomId,
        userId: user._id,
        role: "HOST",
        isConnected: true,
        isReady: false,
      });

      return await buildRoomPayload(ctx, roomId, user._id);
    }

    throw new ConvexError(
      "Could not generate a unique room code. Please try again.",
    );
  },
});

export const join = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const user = await requireUser(ctx);
    const normalizedCode = code.trim().toUpperCase();

    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", normalizedCode))
      .unique();

    if (!room) throw new ConvexError("Room not found.");

    if (room.status !== "waiting") {
      throw new ConvexError("Game has already started.");
    }

    const existingPlayer = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room_and_user", (q) =>
        q.eq("roomId", room._id).eq("userId", user._id),
      )
      .unique();

    if (existingPlayer) {
      throw new ConvexError("You have already joined this room.");
    }

    const players = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    if (players.length >= MAX_ROOM_PLAYERS) {
      throw new ConvexError("Room is full.");
    }

    await ctx.db.insert("roomPlayers", {
      roomId: room._id,
      userId: user._id,
      role: "PLAYER",
      isConnected: true,
      isReady: false,
    });

    return await buildRoomPayload(ctx, room._id, user._id);
  },
});

export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { user, room } = await requireRoomByCode(ctx, code);
    return await buildRoomPayload(ctx, room._id, user._id);
  },
});

export const toggleReady = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { user, room, membership } = await requireRoomByCode(ctx, code);

    const newReady = !membership.isReady;
    await ctx.db.patch(membership._id, { isReady: newReady });

    const character = await ctx.db
      .query("characters")
      .withIndex("by_room_and_user", (q) =>
        q.eq("roomId", room._id).eq("userId", user._id),
      )
      .unique();

    if (character) {
      await ctx.db.patch(character._id, { readyForGame: newReady });
    }

    return await buildRoomPayload(ctx, room._id, user._id);
  },
});

export const startGame = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { user, room } = await requireRoomByCode(ctx, code);

    if (room.hostUserId !== user._id) {
      throw new ConvexError("Only the host can start the game.");
    }

    const roomPlayers = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    for (const player of roomPlayers) {
      const playerUser = await ctx.db.get(player.userId);
      const username = playerUser?.username ?? "Player";

      const character = await ctx.db
        .query("characters")
        .withIndex("by_room_and_user", (q) =>
          q.eq("roomId", room._id).eq("userId", player.userId),
        )
        .unique();

      if (!character) {
        throw new ConvexError(
          `Player '${username}' has not created a character.`,
        );
      }

      if (player.role !== "HOST" && !player.isReady) {
        throw new ConvexError(`Player '${username}' is not ready.`);
      }
    }

    await ctx.db.patch(room._id, { status: "playing" });

    const worldData = await ctx.runMutation(
      internal.worldGenerator.generateWorld,
      { roomId: room._id },
    );

    const persistentNpcs = await ctx.db
      .query("npcs")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    const villageNpcs = persistentNpcs
      .filter((npc) => npc.locationId === worldData.startLocationId)
      .map(persistentNpcToSceneNpc);

    const startNpcs = [...worldData.startNpcs, ...villageNpcs];

    await ctx.runMutation(internal.gameEngine.initializeGame, {
      roomId: room._id,
      startLocationId: worldData.startLocationId,
      startLocationName: worldData.startLocationName,
      startLocationDesc: worldData.startLocationDesc,
      startWeather: worldData.startWeather,
      startNpcs,
      startMonsters: worldData.startMonsters,
      startObjects: worldData.startObjects,
    });

    return await buildRoomPayload(ctx, room._id, user._id);
  },
});

export const kickPlayer = mutation({
  args: { code: v.string(), username: v.string() },
  handler: async (ctx, { code, username }) => {
    const { user, room } = await requireRoomByCode(ctx, code);

    if (room.hostUserId !== user._id) {
      throw new ConvexError("Only the host can kick players.");
    }

    const roomPlayers = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    let targetPlayer = null;
    for (const player of roomPlayers) {
      const playerUser = await ctx.db.get(player.userId);
      if (playerUser?.username === username) {
        targetPlayer = player;
        break;
      }
    }

    if (!targetPlayer) {
      throw new ConvexError("Player not found in this room.");
    }

    if (targetPlayer.userId === room.hostUserId) {
      throw new ConvexError("Cannot kick the host.");
    }

    await ctx.db.delete(targetPlayer._id);

    return {
      ...(await buildRoomPayload(ctx, room._id, user._id)),
      kickedUsername: username,
    };
  },
});

export const transferHost = mutation({
  args: { code: v.string(), username: v.string() },
  handler: async (ctx, { code, username }) => {
    const { user, room } = await requireRoomByCode(ctx, code);

    if (room.hostUserId !== user._id) {
      throw new ConvexError("Only the host can transfer hosting rights.");
    }

    const roomPlayers = await ctx.db
      .query("roomPlayers")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .collect();

    let targetPlayer = null;
    let hostPlayer = null;

    for (const player of roomPlayers) {
      const playerUser = await ctx.db.get(player.userId);
      if (playerUser?.username === username) targetPlayer = player;
      if (player.userId === user._id) hostPlayer = player;
    }

    if (!targetPlayer) {
      throw new ConvexError("Target player not found in this room.");
    }

    await ctx.db.patch(room._id, { hostUserId: targetPlayer.userId });

    if (hostPlayer) {
      await ctx.db.patch(hostPlayer._id, { role: "PLAYER" });
    }
    await ctx.db.patch(targetPlayer._id, { role: "HOST" });

    return await buildRoomPayload(ctx, room._id, user._id);
  },
});

export const deleteRoom = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { user, room } = await requireRoomByCode(ctx, code);

    if (room.hostUserId !== user._id) {
      throw new ConvexError("Only the host can delete the room.");
    }

    await deleteRoomCascade(ctx, room._id);
    return { deleted: true };
  },
});

export const leaveRoom = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const { user, room, membership } = await requireRoomByCode(ctx, code);

    if (room.hostUserId === user._id) {
      await deleteRoomCascade(ctx, room._id);
      return { room: null, roomDeleted: true };
    }

    await ctx.db.delete(membership._id);

    return {
      room: await buildRoomPayload(ctx, room._id, user._id),
      roomDeleted: false,
    };
  },
});
