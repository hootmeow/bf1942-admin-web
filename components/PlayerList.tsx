'use client'

import { useState } from 'react'
import type { RconPlayer } from '@/lib/rcon/types'

interface PlayerListProps {
  players: RconPlayer[]
  serverId: number
}

export function PlayerList({ players, serverId }: PlayerListProps) {
  const [busy, setBusy] = useState<number | null>(null)
  const [showKeys, setShowKeys] = useState(false)

  async function kick(slot: number, name: string) {
    const reason = prompt(`Kick reason for ${name} (shown in console — optional):`) ?? ''
    if (reason === null) return
    setBusy(slot)
    try {
      await fetch(`/api/servers/${serverId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `admin.kickPlayer ${slot}`, playerName: name, reason }),
      })
    } finally {
      setBusy(null)
    }
  }

  async function ban(player: RconPlayer) {
    const reason = prompt(`Ban reason for ${player.name} (leave blank for none):`)
    if (reason === null) return
    setBusy(player.slot)
    try {
      await fetch(`/api/servers/${serverId}/bans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          banType: 'key',
          playerKey: player.playerKey,
          playerName: player.name,
          slot: player.slot,
          reason: reason.trim() || undefined,
        }),
      })
    } finally {
      setBusy(null)
    }
  }

  async function sendMessage(player: RconPlayer) {
    const msg = prompt(`Message to broadcast (will mention ${player.name}):`)
    if (!msg?.trim()) return
    await fetch(`/api/servers/${serverId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `[To ${player.name}]: ${msg.trim()}` }),
    })
  }

  if (players.length === 0) {
    return (
      <div className="p-6 text-sm text-zinc-600">
        No players connected.
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <div className="px-4 py-2 flex items-center justify-between border-b border-zinc-800">
        <span className="text-xs text-zinc-500">{players.length} player{players.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setShowKeys(k => !k)}
          className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          {showKeys ? 'Hide Keys' : 'Show CD Keys'}
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-zinc-950">
          <tr className="border-b border-zinc-800">
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-10">#</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Player</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-20">Ping</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-20">Score</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-20">Team</th>
            {showKeys && (
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">CD Key</th>
            )}
            <th className="px-4 py-3 w-36"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/40">
          {players.map((p) => (
            <tr key={p.slot} className="hover:bg-zinc-900/40 transition-colors">
              <td className="px-4 py-3 text-zinc-600 font-mono text-xs">{p.slot}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-200">{p.name}</span>
                  {!p.isAlive && !p.isJoining && (
                    <span className="text-xs text-zinc-700 bg-zinc-800 px-1 rounded">dead</span>
                  )}
                  {p.isJoining && (
                    <span className="text-xs text-amber-700 bg-amber-950/40 px-1 rounded">joining</span>
                  )}
                </div>
              </td>
              <td className={`px-4 py-3 font-mono text-xs tabular-nums ${
                p.ping > 200 ? 'text-red-400' : p.ping > 100 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {p.ping}ms
              </td>
              <td className="px-4 py-3 text-zinc-400 font-mono text-xs tabular-nums">{p.score}</td>
              <td className="px-4 py-3 text-xs">
                {p.teamId === 1
                  ? <span className="text-blue-400">Allies</span>
                  : p.teamId === 2
                  ? <span className="text-red-400">Axis</span>
                  : <span className="text-zinc-600">—</span>}
              </td>
              {showKeys && (
                <td className="px-4 py-3 font-mono text-xs text-zinc-600 truncate max-w-[140px]" title={p.playerKey}>
                  {p.playerKey}
                </td>
              )}
              <td className="px-4 py-3">
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => sendMessage(p)}
                    disabled={busy === p.slot}
                    className="text-xs text-zinc-500 hover:text-amber-400 disabled:text-zinc-700 transition-colors"
                  >
                    Msg
                  </button>
                  <button
                    onClick={() => kick(p.slot, p.name)}
                    disabled={busy === p.slot}
                    className="text-xs text-zinc-500 hover:text-amber-400 disabled:text-zinc-700 transition-colors"
                  >
                    Kick
                  </button>
                  <button
                    onClick={() => ban(p)}
                    disabled={busy === p.slot}
                    className="text-xs text-zinc-500 hover:text-red-400 disabled:text-zinc-700 transition-colors"
                  >
                    Ban
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
