# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Modern web-based successor to Blackbagops' BFSRM — an admin dashboard for Battlefield 1942 game servers. Replaces the legacy Windows desktop client with a responsive, browser-accessible interface.

**Hosting constraint:** must run on a self-hosted VPS (OVHcloud / DigitalOcean). Serverless platforms (Vercel) are incompatible — the backend requires persistent TCP sockets and child process management.

**Co-location constraint:** the admin panel MUST run on the same server as BF1942. It manages the game process directly via `child_process.spawn()` — not RCON.

## Commands

```bash
# First time setup
cp .env.example .env          # fill in JWT_SECRET
npm install
npm run db:generate           # generate Prisma client
npm run db:push               # create SQLite schema
npm run db:seed               # create default admin user (password: changeme)

# Development
npm run dev                   # starts custom server (tsx watch server.ts)

# Production
npm run build && npm start    # build Next.js, then start custom server

# Utilities
npm run type-check            # tsc --noEmit
npm run lint
npm run db:studio             # Prisma GUI
```

## Architecture

Three runtime layers that must stay clearly separated:

### 1. Custom HTTP server (`server.ts`)
Entry point — creates a Node.js HTTP server, mounts the Next.js request handler, and attaches the Socket.io server to the same HTTP server instance. This is why `npm run dev` runs `tsx watch server.ts` rather than `next dev`.

### 2. Next.js app (`app/`)
Uses the App Router. Server components fetch from Prisma directly. Client components use Socket.io for live updates. The `(dashboard)` route group shares the sidebar layout.

Key routes:
- `/` → redirect based on auth
- `/login` → login form
- `/dashboard` → server list (server component, Prisma)
- `/servers/[id]` → server detail (tabs: Console, Players, Map Rotation, Bans, Settings)

API routes (`app/api/`) handle: auth (login/logout), command dispatch, player list, start/stop/restart, message broadcast, server settings, map rotation, ban management.

### 3. Socket.io server (`lib/socket/index.ts`)
Clients join a room per server: `server:{id}`. The process manager calls broadcast functions when events arrive.

Events emitted to clients:
- `console-line` — raw stdout line from BF1942
- `players-update` — RconPlayer[] from game.listPlayers response
- `process-status` — { running, pid, map, playerCount }

## BF1942 Process Management (`lib/process/`)

The admin panel manages the BF1942 dedicated server as a child process via stdin/stdout.

**Files:**
- `lib/process/manager.ts` — `BF1942ProcessManager` (EventEmitter). Spawns and manages the server process. Methods: `start()`, `stop()`, `restart()`, `sendCommand()`, `requestPlayerList()`. Same event interface as the old RCON client for socket layer compatibility.
- `lib/process/registry.ts` — One manager per server ID. Lazy-creates managers when a browser joins. `startServer()`, `stopServer()`, `restartServer()` for lifecycle management.
- `lib/process/settings.ts` — Read/write `.con` config files (`serversettings.con`, `maplist.con`, `serverbanlist.con`).

**Config file paths (derived from `gameDir`):**
- Settings: `{gameDir}/mods/bf1942/settings/serversettings.con`
- Map list: `{gameDir}/mods/bf1942/settings/maplist.con`
- Ban list: `{gameDir}/mods/bf1942/settings/serverbanlist.con`

**BF1942 stdin commands (sent via `sendCommand()`):**
- `game.listPlayers` — list players (output collected from stdout)
- `admin.kickPlayer <slot>` — kick player
- `admin.banPlayerKey <slot>` — ban by CD key
- `admin.banPlayerIp <slot>` — ban by IP
- `admin.removeKeyBan <key>` — unban by key
- `admin.removeIpBan <ip>` — unban by IP
- `admin.sendTextMessage "text"` — broadcast server message
- `admin.runNextLevel` — force next map
- `admin.restartMap` — restart current map
- `game.setNextLevel "<mapname>"` — set next map

**Player list format** (from game.listPlayers stdout):
```
Player 0 "PlayerName" 0 1 45 100 abc123def 1 0
# fields: slot "name" isBot teamId ping score cdKeyHash isAlive isJoining
```

**Known issue:** BF1942 process output goes to both stdout and stderr. The manager reads both.

**Map IDs (BF1942 level folder names):**
`BattleOfBritain`, `Battleaxe`, `Berlin`, `Bocage`, `CoralSea`, `ElAlamein`, `Gazala`,
`Guadalcanal`, `IwoJima`, `Kharkov`, `Kursk`, `LiberationOfCaen`, `MarketGarden`,
`Midway`, `OmahaBeach`, `OperationAberdeen`, `OperationOverlord`, `Stalingrad`, `Tobruk`

## Database

Prisma + SQLite (dev) / PostgreSQL (prod — change `provider` in `prisma/schema.prisma`).

Models: `User`, `Server`, `MapRotation`, `Ban`, `AuditLog`.

`Server` fields: `name`, `host`, `port`, `binaryPath`, `gameDir` (no RCON fields).
`Ban` fields include `banType` ("key" or "ip"), `ipAddress` (nullable).

Every admin action (kick, ban, map change, exec, start/stop/restart) must be written to `AuditLog`.

## Auth

JWT in an httpOnly cookie (`auth-token`). `middleware.ts` protects all routes except `/login` and `/api/auth/login`. `lib/auth.ts` exposes `getAuthUser()` for server components and API routes. Tokens expire after 8 hours.
