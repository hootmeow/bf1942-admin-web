import { BF1942ProcessManager } from './manager'
import { db } from '@/lib/db/index'
// These imports are circular (socket imports registry, registry imports socket)
// but work fine at runtime — by the time callbacks fire, both modules are initialized.
import { broadcastConsoleLine, broadcastPlayers, broadcastProcessStatus } from '@/lib/socket/index'
import type { ParsedConsoleEvent, RconPlayer } from '@/lib/rcon/types'
import type { ProcessStatus } from './manager'

const managers = new Map<number, BF1942ProcessManager>()

async function loadOpts(serverId: number) {
  return db.server.findUnique({
    where: { id: serverId },
    select: { binaryPath: true, gameDir: true },
  })
}

function attach(serverId: number, mgr: BF1942ProcessManager): void {
  mgr.on('console', (event: ParsedConsoleEvent) => {
    broadcastConsoleLine(serverId, event.raw)
  })
  mgr.on('players', (players: RconPlayer[]) => {
    broadcastPlayers(serverId, players)
  })
  mgr.on('status-changed', (status: ProcessStatus) => {
    broadcastProcessStatus(serverId, status)
  })
}

/** Get or create a manager for the given server (does not start the process). */
export async function ensureManager(serverId: number): Promise<BF1942ProcessManager> {
  const existing = managers.get(serverId)
  if (existing) return existing

  const opts = await loadOpts(serverId)
  if (!opts) throw new Error(`Server ${serverId} not found`)

  const mgr = new BF1942ProcessManager({ binaryPath: opts.binaryPath, gameDir: opts.gameDir })
  managers.set(serverId, mgr)
  attach(serverId, mgr)
  return mgr
}

export function getManager(serverId: number): BF1942ProcessManager | undefined {
  return managers.get(serverId)
}

export async function startServer(serverId: number): Promise<void> {
  const mgr = await ensureManager(serverId)
  await mgr.start()
  mgr.startPolling()
}

export async function stopServer(serverId: number): Promise<void> {
  const mgr = managers.get(serverId)
  if (!mgr) return
  mgr.stopPolling()
  await mgr.stop()
}

export async function restartServer(serverId: number): Promise<void> {
  const mgr = managers.get(serverId)
  if (!mgr) throw new Error(`Server ${serverId} not managed`)
  mgr.stopPolling()
  await mgr.restart()
  mgr.startPolling()
}

export function disconnectServer(serverId: number): void {
  const mgr = managers.get(serverId)
  if (!mgr) return
  mgr.disconnect()
  managers.delete(serverId)
}

export function disconnectAll(): void {
  for (const id of [...managers.keys()]) disconnectServer(id)
}
