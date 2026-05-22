import type { RconPlayer, ParsedConsoleEvent, ConsoleEventType } from './types'

/**
 * Parse the output lines from `game.listPlayers`.
 *
 * The exact column layout of BF1942's listPlayers output is not officially documented.
 * This parser handles the two most commonly observed formats from community captures.
 * If parsing fails against a real server, log the raw lines and adjust the regexes.
 *
 * Observed format A (most common):
 *   #Player 0 "PlayerName" 0 1 56 10 abc123def456 0 0
 *   fields: slot name isBot teamId ping score cdKeyHash isAlive isJoining
 *
 * Observed format B (verbose):
 *   #Player 0: name="PlayerName" team=1 ping=56 score=10 cdkey=abc123
 */
export function parsePlayerList(lines: string[]): RconPlayer[] {
  const players: RconPlayer[] = []

  for (const line of lines) {
    const player = parsePlayerLineA(line) ?? parsePlayerLineB(line)
    if (player) players.push(player)
  }

  return players.sort((a, b) => a.slot - b.slot)
}

// Format A: positional whitespace-delimited
function parsePlayerLineA(line: string): RconPlayer | null {
  // Match: "Player <slot> "<name>" <isBot> <teamId> <ping> <score> <cdkey> <isAlive> <isJoining>"
  const m = line.match(/^Player\s+(\d+)\s+"([^"]*)"\s+(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(\S+)\s+(\d+)\s+(\d+)/i)
  if (!m) return null
  return {
    slot: parseInt(m[1]),
    name: m[2],
    teamId: parseInt(m[4]),
    ping: parseInt(m[5]),
    score: parseInt(m[6]),
    playerKey: m[7],
    isAlive: m[8] === '1',
    isJoining: m[9] === '1',
  }
}

// Format B: key=value pairs
function parsePlayerLineB(line: string): RconPlayer | null {
  const slotM = line.match(/Player\s+(\d+)/i)
  if (!slotM) return null

  const get = (key: string) => line.match(new RegExp(`${key}=["']?([^"'\\s]+)["']?`, 'i'))?.[1]

  const name = line.match(/name=["']([^"']*)["']/i)?.[1]
  const ping = get('ping')
  const score = get('score')
  const teamId = get('team') ?? get('teamId') ?? get('teamindex')
  const cdkey = get('cdkey') ?? get('key') ?? get('hash')

  if (!name || !ping || !cdkey) return null

  return {
    slot: parseInt(slotM[1]),
    name,
    ping: parseInt(ping),
    score: parseInt(score ?? '0'),
    teamId: parseInt(teamId ?? '0'),
    playerKey: cdkey,
    isAlive: false,
    isJoining: false,
  }
}

/**
 * Parse a single console line (already stripped of the leading `#`) into a typed event.
 *
 * BF1942 console format is freeform English text — these patterns cover observed formats
 * but will need tuning if the live server output differs.
 */
export function parseConsoleEvent(raw: string): ParsedConsoleEvent {
  const timestamp = new Date()

  // Chat: "SoldierName GlobalMessage text"  or  "SoldierName TeamMessage text"
  const chatM = raw.match(/^(\S+)\s+(?:GlobalMessage|TeamMessage|ServerMessage)\s+(.+)$/i)
  if (chatM) {
    return { type: 'chat', timestamp, raw, playerName: chatM[1], message: chatM[2] }
  }

  // Kill: "SoldierName killed SoldierName" or "SoldierName teamkilled SoldierName"
  const killM = raw.match(/^(\S+)\s+(?:killed|teamkilled)\s+(\S+)/i)
  if (killM) {
    return { type: 'kill', timestamp, raw, playerName: killM[1] }
  }

  // Connect: "SoldierName connected"
  const connectM = raw.match(/^(.+?)\s+connected/i)
  if (connectM) {
    return { type: 'connect', timestamp, raw, playerName: connectM[1] }
  }

  // Disconnect: "SoldierName disconnected"
  const disconnectM = raw.match(/^(.+?)\s+disconnected/i)
  if (disconnectM) {
    return { type: 'disconnect', timestamp, raw, playerName: disconnectM[1] }
  }

  // Round end / map change
  if (/(?:round|map|level)\s+(?:over|end|change|loading)/i.test(raw)) {
    return { type: 'round-end', timestamp, raw }
  }

  return { type: 'raw', timestamp, raw }
}
