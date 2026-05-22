/**
 * Legacy RCON registry — no longer used. Process management replaced RCON.
 * Kept as a stub to avoid import errors from any tooling that references the file.
 */

import { BF1942RconClient } from './client'

const connections = new Map<number, BF1942RconClient>()

export function getClient(_serverId: number): BF1942RconClient | undefined {
  return connections.get(_serverId)
}

export function disconnectServer(serverId: number): void {
  const client = connections.get(serverId)
  if (client) { client.disconnect(); connections.delete(serverId) }
}

export function disconnectAll(): void {
  for (const id of connections.keys()) disconnectServer(id)
}
