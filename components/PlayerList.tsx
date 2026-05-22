'use client'

import { useState } from 'react'
import type { RconPlayer } from '@/lib/rcon/types'

interface PlayerListProps {
  players: RconPlayer[]
  serverId: number
}

export function PlayerList({ players, serverId }: PlayerListProps) {
  const [busy, setBusy] = useState<number | null>(null)

  async function kick(slot: number, name: string) {
    if (!confirm(`Kick ${name}?`)) return
    setBusy(slot)
    try {
      await fetch(`/api/servers/${serverId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: `admin.kickPlayer ${slot}`, playerName: name }),
      })
    } finally {
      setBusy(null)
    }
  }

  async function ban(player: RconPlayer) {
    const reason = prompt(`Ban reason for ${player.name} (leave blank for none):`)
    if (reason === null) return // cancelled
    setBusy(player.slot)
    try {
      await fetch(`/api/servers/${serverId}/bans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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

  if (players.length === 0) {
    return (
      <div className="p-6 text-sm text-zinc-600">
        No players connected — or RCON player list not yet available.
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-zinc-950">
          <tr className="border-b border-zinc-800">
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-10">#</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Player</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-20">Ping</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-20">Score</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-20">Team</th>
            <th className="px-4 py-3 w-28"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/40">
          {players.map((p) => (
            <tr key={p.slot} className="hover:bg-zinc-900/40 transition-colors">
              <td className="px-4 py-3 text-zinc-600 font-mono text-xs">{p.slot}</td>
              <td className="px-4 py-3 text-zinc-200">{p.name}</td>
              <td className={`px-4 py-3 font-mono text-xs tabular-nums ${
                p.ping > 200 ? 'text-red-400' : p.ping > 100 ? 'text-amber-400' : 'text-emerald-400'
              }`}>
                {p.ping}ms
              </td>
              <td className="px-4 py-3 text-zinc-400 font-mono text-xs tabular-nums">{p.score}</td>
              <td className="px-4 py-3 text-zinc-600 text-xs">
                {p.teamId === 1 ? 'Allies' : p.teamId === 2 ? 'Axis' : '—'}
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-3 justify-end">
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
