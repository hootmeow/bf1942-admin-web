'use client'

import { useState, useEffect } from 'react'

const VANILLA_MAPS = [
  'Battle of Britain',
  'Battleaxe',
  'Berlin',
  'Bocage',
  'Coral Sea',
  'El Alamein',
  'Gazala',
  'Guadalcanal',
  'Iwo Jima',
  'Kharkov',
  'Kursk',
  'Liberation of Caen',
  'Market Garden',
  'Midway',
  'Omaha Beach',
  'Operation Aberdeen',
  'Operation Overlord',
  'Stalingrad',
  'Tobruk',
]

type Status = { type: 'ok' | 'warn' | 'err'; msg: string } | null

export function MapRotationEditor({ serverId }: { serverId: number }) {
  const [maps, setMaps] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [selectedMap, setSelectedMap] = useState(VANILLA_MAPS[0])
  const [customMap, setCustomMap] = useState('')

  useEffect(() => {
    fetch(`/api/servers/${serverId}/maps`)
      .then((r) => r.json())
      .then((data) => { setMaps(data.maps ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [serverId])

  async function save(pushToServer = false) {
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/servers/${serverId}/maps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maps, pushToServer }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus({ type: data.warning ? 'warn' : 'ok', msg: data.warning ?? 'Rotation saved.' })
      } else {
        setStatus({ type: 'err', msg: data.error ?? 'Failed to save.' })
      }
    } catch {
      setStatus({ type: 'err', msg: 'Network error.' })
    } finally {
      setSaving(false)
    }
  }

  function addMap() {
    const name = customMap.trim() || selectedMap
    if (!name) return
    if (maps.includes(name)) {
      setStatus({ type: 'warn', msg: `"${name}" is already in the rotation.` })
      return
    }
    setMaps((prev) => [...prev, name])
    setCustomMap('')
    setStatus(null)
  }

  function remove(index: number) {
    setMaps((prev) => prev.filter((_, i) => i !== index))
  }

  function move(index: number, dir: -1 | 1) {
    const next = index + dir
    if (next < 0 || next >= maps.length) return
    const copy = [...maps]
    ;[copy[index], copy[next]] = [copy[next], copy[index]]
    setMaps(copy)
  }

  if (loading) {
    return <div className="p-6 text-sm text-zinc-600">Loading…</div>
  }

  return (
    <div className="p-6 max-w-lg space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">Map Rotation</h3>
          <p className="text-xs text-zinc-600 mt-0.5">{maps.length} maps · drag order with ↑ ↓</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => save(false)}
            disabled={saving}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => save(true)}
            disabled={saving || maps.length === 0}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-semibold rounded-lg transition-colors"
            title="Save and queue the first map as the next map on the server"
          >
            Save & Queue Next
          </button>
        </div>
      </div>

      {/* Status */}
      {status && (
        <p className={`text-xs ${
          status.type === 'ok' ? 'text-emerald-400' :
          status.type === 'warn' ? 'text-amber-400' :
          'text-red-400'
        }`}>
          {status.msg}
        </p>
      )}

      {/* Rotation list */}
      {maps.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-xl py-8 text-center text-sm text-zinc-600">
          No maps in rotation. Add some below.
        </div>
      ) : (
        <ol className="space-y-1.5">
          {maps.map((map, i) => (
            <li
              key={`${map}-${i}`}
              className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2.5"
            >
              <span className="text-xs text-zinc-700 w-5 text-right tabular-nums shrink-0">{i + 1}</span>
              <span className="flex-1 text-sm text-zinc-200">{map}</span>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors px-1"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === maps.length - 1}
                className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 transition-colors px-1"
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                onClick={() => remove(i)}
                className="text-zinc-600 hover:text-red-400 transition-colors px-1"
                aria-label="Remove"
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}

      {/* Add map */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Add Map</p>
        <div className="flex gap-2">
          <select
            value={selectedMap}
            onChange={(e) => setSelectedMap(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30 transition-colors"
          >
            {VANILLA_MAPS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => { setCustomMap(''); addMap() }}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs rounded-lg transition-colors whitespace-nowrap"
          >
            + Add
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customMap}
            onChange={(e) => setCustomMap(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMap())}
            placeholder="Custom or modded map name…"
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30 transition-colors"
          />
          <button
            type="button"
            onClick={addMap}
            disabled={!customMap.trim()}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs rounded-lg transition-colors whitespace-nowrap"
          >
            + Add Custom
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-700">
        "Save & Queue Next" sends <code className="font-mono">game.setNextLevel</code> with the first map to the live server. The full rotation list is stored here in the admin panel — BF1942 does not expose a way to push a full rotation via RCON.
      </p>
    </div>
  )
}
