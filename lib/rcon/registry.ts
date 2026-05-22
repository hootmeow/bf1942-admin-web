/**
 * Manages one BF1942RconClient per server ID.
 *
 * One shared connection services all browser clients watching the same server.
 * Polls for player list every PLAYER_POLL_MS and broadcasts via Socket.io.
 * Automatically reconnects on disconnect with exponential backoff.
 */

import { BF1942RconClient } from './client'
import { db } from '@/lib/db/index'
import { broadcastConsoleLine, broadcastPlayers } from '@/lib/socket/index'
import type { ParsedConsoleEvent } from './types'

const PLAYER_POLL_MS = 10_000
const MAX_BACKOFF_MS = 60_000

interface ManagedConnection {
  client: BF1942RconClient
  pollTimer: ReturnType<typeof setInterval> | null
  backoffMs: number
  reconnectTimer: ReturnType<typeof setTimeout> | null
}

const connections = new Map<number, ManagedConnection>()

export async function connectServer(serverId: number): Promise<BF1942RconClient> {
  const existing = connections.get(serverId)
  if (existing?.client.isAuthenticated) return existing.client

  const server = await db.server.findUnique({
    where: { id: serverId },
    select: { host: true, rconPort: true, rconUser: true, rconPass: true },
  })
  if (!server) throw new Error(`Server ${serverId} not found in database`)

  const client = new BF1942RconClient({
    host: server.host,
    rconPort: server.rconPort,
    username: server.rconUser,
    password: server.rconPass,
  })

  const conn: ManagedConnection = {
    client,
    pollTimer: null,
    backoffMs: 2_000,
    reconnectTimer: null,
  }
  connections.set(serverId, conn)

  client.on('console', (event: ParsedConsoleEvent) => {
    broadcastConsoleLine(serverId, event.raw)
  })

  client.on('players', (players) => {
    broadcastPlayers(serverId, players)
  })

  client.on('error', (err: Error) => {
    console.error(`[RCON] Server ${serverId} error:`, err.message)
  })

  client.on('disconnect', () => {
    if (conn.pollTimer) {
      clearInterval(conn.pollTimer)
      conn.pollTimer = null
    }
    // Only reconnect if this client is still the active one for this server.
    // Prevents duplicate reconnect chains when a failed-auth client is replaced.
    if (connections.get(serverId)?.client === client) {
      scheduleReconnect(serverId, conn)
    }
  })

  client.on('authenticated', () => {
    conn.backoffMs = 2_000
    conn.pollTimer = setInterval(() => {
      if (client.isAuthenticated) client.requestPlayerList()
    }, PLAYER_POLL_MS)
    // Immediate first poll
    client.requestPlayerList()
  })

  await client.connect()
  return client
}

function scheduleReconnect(serverId: number, conn: ManagedConnection): void {
  conn.reconnectTimer = setTimeout(async () => {
    conn.reconnectTimer = null
    try {
      await connectServer(serverId)
      console.log(`[RCON] Reconnected to server ${serverId}`)
    } catch (err) {
      const msg = (err as Error).message ?? ''
      console.error(`[RCON] Reconnect failed for server ${serverId}:`, msg)
      // Auth failures won't be fixed by retrying — stop the loop.
      if (msg.includes('authentication failed')) {
        console.error(`[RCON] Server ${serverId}: stopping reconnect loop — fix credentials in Settings.`)
        connections.delete(serverId)
        return
      }
      conn.backoffMs = Math.min(conn.backoffMs * 2, MAX_BACKOFF_MS)
      scheduleReconnect(serverId, conn)
    }
  }, conn.backoffMs)
}

export function getClient(serverId: number): BF1942RconClient | undefined {
  return connections.get(serverId)?.client
}

export function disconnectServer(serverId: number): void {
  const conn = connections.get(serverId)
  if (!conn) return
  if (conn.pollTimer) clearInterval(conn.pollTimer)
  if (conn.reconnectTimer) clearTimeout(conn.reconnectTimer)
  conn.client.disconnect()
  connections.delete(serverId)
}

export function disconnectAll(): void {
  for (const id of connections.keys()) {
    disconnectServer(id)
  }
}
