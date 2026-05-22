'use client'

import { useState, useEffect } from 'react'

interface Ban {
  id: number
  playerName: string
  playerKey: string
  reason: string | null
  bannedBy: string
  bannedAt: string
  expiresAt: string | null
}

export function BanList({ serverId }: { serverId: number }) {
  const [bans, setBans] = useState<Ban[]>([])
  const [loading, setLoading] = useState(true)
  const [unbanning, setUnbanning] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/servers/${serverId}/bans`)
      .then((r) => r.json())
      .then((data) => { setBans(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [serverId])

  async function handleUnban(ban: Ban) {
    if (!confirm(`Unban ${ban.playerName}?\n\nNote: this removes the ban from the admin panel. If the ban was pushed to the server, you may also need to remove it from the server's banlist.cfg file.`)) return
    setUnbanning(ban.id)
    try {
      const res = await fetch(`/api/servers/${serverId}/bans/${ban.id}`, { method: 'DELETE' })
      if (res.ok) {
        setBans((prev) => prev.filter((b) => b.id !== ban.id))
      }
    } finally {
      setUnbanning(null)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-zinc-600">Loading…</div>
  }

  if (bans.length === 0) {
    return (
      <div className="p-6 text-sm text-zinc-600">
        No bans recorded for this server.
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-zinc-950">
          <tr className="border-b border-zinc-800">
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Player</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Reason</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-24">Banned By</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-28">Date</th>
            <th className="px-4 py-3 w-20"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/40">
          {bans.map((ban) => (
            <tr key={ban.id} className="hover:bg-zinc-900/40 transition-colors">
              <td className="px-4 py-3">
                <div className="text-zinc-200 text-sm">{ban.playerName}</div>
                <div className="text-xs text-zinc-600 font-mono mt-0.5 truncate max-w-xs">{ban.playerKey}</div>
              </td>
              <td className="px-4 py-3 text-zinc-400 text-xs">{ban.reason ?? <span className="text-zinc-700">—</span>}</td>
              <td className="px-4 py-3 text-zinc-500 text-xs">{ban.bannedBy}</td>
              <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                {new Date(ban.bannedAt).toLocaleDateString()}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => handleUnban(ban)}
                  disabled={unbanning === ban.id}
                  className="text-xs text-zinc-500 hover:text-red-400 disabled:text-zinc-700 transition-colors"
                >
                  {unbanning === ban.id ? '…' : 'Unban'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
