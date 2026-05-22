# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Modern web-based successor to Blackbagops' BFSRM — an admin dashboard for Battlefield 1942 game servers. Replaces the legacy Windows desktop client with a responsive, browser-accessible interface.

**Hosting constraint:** must run on a self-hosted VPS (OVHcloud / DigitalOcean). Serverless platforms (Vercel) are incompatible — the backend requires persistent TCP sockets to game servers.

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
- `/servers/[id]` → server detail (tabs: Console, Players, Map Rotation, Settings)

API routes (`app/api/`) handle: auth (login/logout), command dispatch, player list. All mutating commands write to the `AuditLog` table before attempting execution.

### 3. Socket.io server (`lib/socket/index.ts`)
Clients join a room per server: `server:{id}`. The RCON daemon (not yet implemented) will call `broadcastConsoleLine()` and `broadcastPlayers()` from `lib/socket/index.ts` when events arrive from the game server.

## BF1942 RCON Protocol (`lib/rcon/`)

Source: CVE-2003-1355 disclosure + icculus.org BF1942 mailing list (Feb 2003). **No Wireshark capture needed** — the protocol is fully implemented.

**Wire protocol (TCP, port 4711 by default):**
1. Server → Client: 10-byte XOR key
2. Client → Server: `uint32LE(usernameLen)` + `xor(username, key)` + `uint32LE(passwordLen)` + `xor(password, key)`
3. Server → Client: `0x01` = success, anything else = failure
4. Post-auth: plain text, newline-delimited. Every server console line arrives prefixed with `#`.
5. Commands are raw console commands: `admin.kickPlayer 1\n`, `game.listPlayers\n`, etc.

**Username/password constraint:** must be pure alphanumeric — all-letters OR all-digits. No mixed, no spaces. Server rejects with "Unauthorized".

**Known server bug:** enabling remote console causes the server to hang on map changes. The registry reconnects automatically after disconnect.

**Files:**
- `lib/rcon/types.ts` — TypeScript interfaces (`RconPlayer`, `ParsedConsoleEvent`, etc.)
- `lib/rcon/client.ts` — `BF1942RconClient` (EventEmitter). Emits: `authenticated`, `console`, `players`, `error`, `disconnect`
- `lib/rcon/parser.ts` — `parsePlayerList()` and `parseConsoleEvent()`. **The player list regex is a best-effort guess — test against a real server and adjust if it returns empty.**
- `lib/rcon/registry.ts` — One client per server ID. Auto-reconnect with exponential backoff. Polls player list every 10s. Called by `lib/socket/index.ts` when a browser joins a server room.

**What still needs a real server to verify:** the exact column layout of `game.listPlayers` output. If `requestPlayerList()` returns `[]` on a live server, add a temporary `console.log` to `drainTextLines()` to see the raw lines, then fix the regexes in `parser.ts`.

## Database

Prisma + SQLite (dev) / PostgreSQL (prod — change `provider` in `prisma/schema.prisma`).

Models: `User`, `Server`, `MapRotation`, `Ban`, `AuditLog`.

Every admin action (kick, ban, map change, exec) must be written to `AuditLog` — see `app/api/servers/[id]/command/route.ts` for the pattern.

## Auth

JWT in an httpOnly cookie (`auth-token`). `middleware.ts` protects all routes except `/login` and `/api/auth/login`. `lib/auth.ts` exposes `getAuthUser()` for server components and API routes. Tokens expire after 8 hours.
