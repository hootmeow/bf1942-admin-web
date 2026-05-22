'use client'

import { useState, useEffect } from 'react'

interface Ban {
  id: number
  banType: string
  playerName: string
  playerKey: string
  ipAddress: string | null
  reason: string | null
  bannedBy: string
  bannedAt: string
  expiresAt: string | null
}

interface AddBanForm {
  banType: 'key' | 'ip'
  playerName: string
  playerKey: string
  ipAddress: string
  reason: string
}

const EMPTY_FORM: AddBanForm = {
  banType: 'key',
  playerName: '',
  playerKey: '',
  ipAddress: '',
  reason: '',
}

export function BanList({ serverId }: { serverId: number }) {
  const [bans, setBans] = useState<Ban[]>([])
  const [loading, setLoading] = useState(true)
  const [unbanning, setUnbanning] = useState<number | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState<AddBanForm>(EMPTY_FORM)
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetch(`/api/servers/${serverId}/bans`)
      .then((r) => r.json())
      .then((data) => { setBans(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [serverId])

  async function handleUnban(ban: Ban) {
    if (!confirm(`Unban ${ban.playerName}? This also removes them from serverbanlist.con.`)) return
    setUnbanning(ban.id)
    try {
      const res = await fetch(`/api/servers/${serverId}/bans/${ban.id}`, { method: 'DELETE' })
      if (res.ok) setBans((prev) => prev.filter((b) => b.id !== ban.id))
    } finally {
      setUnbanning(null)
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    setAdding(true)
    try {
      const res = await fetch(`/api/servers/${serverId}/bans`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          banType: form.banType,
          playerName: form.playerName.trim(),
          playerKey: form.playerKey.trim() || undefined,
          ipAddress: form.ipAddress.trim() || undefined,
          reason: form.reason.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error ?? 'Failed to add ban'); return }
      setBans(prev => [data, ...prev])
      setForm(EMPTY_FORM)
      setShowAdd(false)
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <div className="p-6 text-sm text-zinc-600">Loading…</div>

  return (
    <div className="overflow-auto">
      <div className="px-4 py-3 flex items-center justify-between border-b border-zinc-800">
        <span className="text-xs text-zinc-500">{bans.length} ban{bans.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setShowAdd(s => !s)}
          className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
        >
          {showAdd ? 'Cancel' : '+ Add Ban'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="p-4 border-b border-zinc-800 bg-zinc-900/50 space-y-3">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Manual Ban</p>

          <div className="flex gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="banType" value="key" checked={form.banType === 'key'}
                onChange={() => setForm(f => ({ ...f, banType: 'key' }))}
                className="accent-amber-500" />
              <span className="text-xs text-zinc-300">CD Key Ban</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="radio" name="banType" value="ip" checked={form.banType === 'ip'}
                onChange={() => setForm(f => ({ ...f, banType: 'ip' }))}
                className="accent-amber-500" />
              <span className="text-xs text-zinc-300">IP Ban</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              required
              placeholder="Player name"
              value={form.playerName}
              onChange={e => setForm(f => ({ ...f, playerName: e.target.value }))}
              className={inputCls}
            />
            {form.banType === 'key' ? (
              <input
                required
                placeholder="CD key hash"
                value={form.playerKey}
                onChange={e => setForm(f => ({ ...f, playerKey: e.target.value }))}
                className={inputCls}
              />
            ) : (
              <input
                required
                placeholder="IP address (e.g. 1.2.3.4)"
                value={form.ipAddress}
                onChange={e => setForm(f => ({ ...f, ipAddress: e.target.value }))}
                className={inputCls}
              />
            )}
            <input
              placeholder="Reason (optional)"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className={`${inputCls} col-span-2`}
            />
          </div>

          {addError && <p className="text-xs text-red-400">{addError}</p>}

          <button
            type="submit"
            disabled={adding}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {adding ? 'Banning…' : 'Add Ban'}
          </button>
        </form>
      )}

      {bans.length === 0 ? (
        <div className="p-6 text-sm text-zinc-600">No bans recorded for this server.</div>
      ) : (
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-950">
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider w-16">Type</th>
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
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    ban.banType === 'ip' ? 'bg-purple-900/40 text-purple-400' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {ban.banType === 'ip' ? 'IP' : 'Key'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-zinc-200 text-sm">{ban.playerName}</div>
                  <div className="text-xs text-zinc-600 font-mono mt-0.5 truncate max-w-[200px]">
                    {ban.banType === 'ip' ? ban.ipAddress : ban.playerKey}
                  </div>
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
      )}
    </div>
  )
}

const inputCls =
  'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30 transition-colors'
