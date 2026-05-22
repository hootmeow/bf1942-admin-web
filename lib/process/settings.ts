import * as fs from 'fs'
import * as path from 'path'

export type ConSettings = Record<string, string>

/** Parse a BF1942 .con file into a lowercase-key map. */
export function parseConFile(content: string): ConSettings {
  const settings: ConSettings = {}
  for (const raw of content.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('//')) continue
    const spaceIdx = line.indexOf(' ')
    if (spaceIdx === -1) {
      settings[line.toLowerCase()] = ''
      continue
    }
    const key = line.slice(0, spaceIdx).toLowerCase()
    const rest = line.slice(spaceIdx + 1).trim()
    settings[key] = rest.startsWith('"') && rest.endsWith('"') ? rest.slice(1, -1) : rest
  }
  return settings
}

// Paths derived from gameDir
export const settingsPath = (gameDir: string) =>
  path.join(gameDir, 'mods', 'bf1942', 'settings', 'serversettings.con')
export const mapListPath = (gameDir: string) =>
  path.join(gameDir, 'mods', 'bf1942', 'settings', 'maplist.con')
export const banListPath = (gameDir: string) =>
  path.join(gameDir, 'mods', 'bf1942', 'settings', 'serverbanlist.con')

// Server settings — raw key/value map
export function readServerSettings(gameDir: string): ConSettings {
  try { return parseConFile(fs.readFileSync(settingsPath(gameDir), 'utf8')) } catch { return {} }
}

export function writeServerSettings(gameDir: string, settings: ConSettings): void {
  const content = Object.entries(settings).map(([key, value]) => {
    const needsQuotes = value === '' || /[\s"']/.test(value)
    return `${key} ${needsQuotes ? `"${value}"` : value}`
  }).join('\n') + '\n'
  fs.mkdirSync(path.dirname(settingsPath(gameDir)), { recursive: true })
  fs.writeFileSync(settingsPath(gameDir), content, 'utf8')
}

// Map list
export interface MapEntry {
  name: string
  mode: string
  players?: number
}

export function readMapList(gameDir: string): MapEntry[] {
  try {
    const content = fs.readFileSync(mapListPath(gameDir), 'utf8')
    const maps: MapEntry[] = []
    for (const raw of content.split('\n')) {
      const m = raw.trim().match(/mapList\.append\s+"([^"]+)"\s+"([^"]+)"(?:\s+(\d+))?/i)
      if (m) maps.push({ name: m[1], mode: m[2], players: m[3] ? parseInt(m[3]) : undefined })
    }
    return maps
  } catch { return [] }
}

export function writeMapList(gameDir: string, maps: MapEntry[]): void {
  const content = maps.map(({ name, mode, players }) =>
    players !== undefined
      ? `mapList.append "${name}" "${mode}" ${players}`
      : `mapList.append "${name}" "${mode}"`
  ).join('\n') + '\n'
  fs.mkdirSync(path.dirname(mapListPath(gameDir)), { recursive: true })
  fs.writeFileSync(mapListPath(gameDir), content, 'utf8')
}

// Ban list
export interface FileBanEntry {
  type: 'key' | 'ip'
  value: string
}

export function readBanList(gameDir: string): FileBanEntry[] {
  try {
    const content = fs.readFileSync(banListPath(gameDir), 'utf8')
    const bans: FileBanEntry[] = []
    for (const raw of content.split('\n')) {
      const line = raw.trim()
      const keyM = line.match(/^keybanned\s+"?([^"\s]+)"?/i)
      if (keyM) { bans.push({ type: 'key', value: keyM[1] }); continue }
      const ipM = line.match(/^ipbanned\s+(\S+)/i)
      if (ipM) bans.push({ type: 'ip', value: ipM[1] })
    }
    return bans
  } catch { return [] }
}

export function writeBanList(gameDir: string, bans: FileBanEntry[]): void {
  const keys = bans.filter(b => b.type === 'key')
  const ips = bans.filter(b => b.type === 'ip')
  const lines: string[] = []
  if (keys.length) { lines.push('# Banned CD Keys:'); keys.forEach(b => lines.push(`keybanned "${b.value}"`)) }
  if (ips.length) { lines.push('# Banned IPs:'); ips.forEach(b => lines.push(`ipbanned ${b.value}`)) }
  fs.mkdirSync(path.dirname(banListPath(gameDir)), { recursive: true })
  fs.writeFileSync(banListPath(gameDir), lines.join('\n') + '\n', 'utf8')
}
