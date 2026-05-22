// BF1942 RCON — Refractor 1 engine, TCP port 4711.
// Protocol reverse-engineered from CVE-2003-1355 disclosure and icculus.org mailing list.

export interface RconConnectionOptions {
  host: string
  rconPort: number
  /** Must be all-letters OR all-digits — no mixed alphanumeric, no spaces. */
  username: string
  password: string
}

export interface RconPlayer {
  slot: number
  name: string
  score: number
  ping: number
  teamId: number
  /** BF1942 CD key hash — stable identifier used for bans */
  playerKey: string
  isAlive: boolean
  isJoining: boolean
}

export interface RconServerStatus {
  map: string
  players: number
  maxPlayers: number
}

export type ConsoleEventType =
  | 'chat'
  | 'kill'
  | 'connect'
  | 'disconnect'
  | 'round-end'
  | 'raw'

export interface ParsedConsoleEvent {
  type: ConsoleEventType
  timestamp: Date
  raw: string
  playerName?: string
  message?: string
}
