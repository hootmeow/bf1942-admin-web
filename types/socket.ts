import type { RconPlayer, ParsedConsoleEvent } from '@/lib/rcon/types'

export interface ProcessStatus {
  running: boolean
  pid?: number
  map: string
  playerCount: number
}

export interface ServerToClientEvents {
  'console-line': (line: string) => void
  'players-update': (players: RconPlayer[]) => void
  'server-status': (status: { map: string; players: number; maxPlayers: number }) => void
  'chat-message': (event: ParsedConsoleEvent) => void
  'process-status': (status: ProcessStatus) => void
}

export interface ClientToServerEvents {
  'join-server': (serverId: string) => void
  'leave-server': (serverId: string) => void
}
