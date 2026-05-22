'use client'

import { useState, useEffect } from 'react'

// BF1942 level folder names → display names
const MAP_NAMES: Record<string, string> = {
  BattleOfBritain: 'Battle of Britain',
  Battleaxe: 'Battleaxe',
  Berlin: 'Berlin',
  Bocage: 'Bocage',
  CoralSea: 'Coral Sea',
  ElAlamein: 'El Alamein',
  Gazala: 'Gazala',
  Guadalcanal: 'Guadalcanal',
  IwoJima: 'Iwo Jima',
  Kharkov: 'Kharkov',
  Kursk: 'Kursk',
  LiberationOfCaen: 'Liberation of Caen',
  MarketGarden: 'Market Garden',
  Midway: 'Midway',
  OmahaBeach: 'Omaha Beach',
  OperationAberdeen: 'Operation Aberdeen',
  OperationOverlord: 'Operation Overlord',
  Stalingrad: 'Stalingrad',
  Tobruk: 'Tobruk',
}

function displayName(id: string): string {
  return MAP_NAMES[id] ?? id
}

const VANILLA_MAPS = Object.keys(MAP_NAMES)

type Status = { type: 'ok' | 'warn' | 'err'; msg: string } | null

export function MapRotationEditor({ serverId }: { serverId: number }) {
  const [maps, setMaps] = useState<string[]>([])
  const [currentMap, setCurrentMap] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [cmdBusy, setCmdBusy] = useState('')
  const [status, setStatus] = useState<Status>(null)
  const [selectedMap, setSelectedMap] = useState(VANILLA_MAPS[0])
  const [customMap, setCustomMap] = useState('')

  useEffect(() => {
    fetch(`/api/servers/${serverId}/maps`)
      .then((r) => r.json())
      .then((data) => {
        setMaps(data.maps ?? [])
        setCurrentMap(data.currentMap ?? '')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [serverId])

  async function save(pushToServer = false) {
    setSaving(true)
    setStatus(null)
    try {
      const res = await fetch(`/api/servers/${serverId}/maps`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maps, mode: 'gpm_conquest', pushToServer }),
      })
      const data = await res.json()
      setStatus({
        type: data.warning ? 'warn' : res.ok ? 'ok' : 'err',
        msg: data.warning ?? data.error ?? 'Rotation saved to maplist.con.',
      })
    } catch {
      setStatus({ type: 'err', msg: 'Network error.' })
    } finally {
      setSaving(false)
    }
  }

  async function runCommand(command: string, label: string) {
    setCmdBusy(label)
    try {
      const res = await fetch(`/api/servers/${serverId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      })
      const data = await res.json()
      if (!res.ok) setStatus({ type: 'err', msg: data.error ?? 'Command failed.' })
      else setStatus({ type: 'ok', msg: `${label} sent.` })
    } catch {
      setStatus({ type: 'err', msg: 'Network error.' })
    } finally {
      setCmdBusy('')
    }
  }

  function addMap() {
    const name = customMap.trim() || selectedMap
    if (!name) return
    if (maps.includes(name)) {
      setStatus({ type: 'warn', msg: `"${displayName(name)}" is already in the rotation.` })
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

  if (loading) return <div className="p-6 text-sm text-zinc-600">Loading…</div>

  return (
    <div className="p-6 max-w-lg space-y-5">
      {/* Current map + live controls */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Current Map</p>
            <p className="text-sm text-zinc-200 mt-1">
              {currentMap ? displayName(currentMap) : <span className="text-zinc-600">Unknown / Server not running</span>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 pt-1 border-t border-zinc-800">
          <button
            onClick={() => runCommand('admin.runNextLevel', 'Force Next Map')}
            disabled={!!cmdBusy}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs rounded-lg transition-colors"
          >
            {cmdBusy === 'Force Next Map' ? '…' : 'Force Next Map'}
          </button>
          <button
            onClick={() => runCommand('admin.restartMap', 'Restart Map')}
            disabled={!!cmdBusy}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs rounded-lg transition-colors"
          >
            {cmdBusy === 'Restart Map' ? '…' : 'Restart Map'}
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">Map Rotation</h3>
          <p className="text-xs text-zinc-600 mt-0.5">{maps.length} maps · reorder with ↑ ↓</p>
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
            title="Save and queue the first map as next"
          >
            Save & Queue Next
          </button>
        </div>
      </div>

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
              className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 transition-colors ${
                map === currentMap
                  ? 'bg-amber-950/20 border-amber-700/40'
                  : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              <span className="text-xs text-zinc-700 w-5 text-right tabular-nums shrink-0">{i + 1}</span>
              <span className="flex-1 text-sm text-zinc-200">{displayName(map)}</span>
              {map === currentMap && (
                <span className="text-xs text-amber-500 bg-amber-900/30 px-1.5 py-0.5 rounded">current</span>
              )}
              <button onClick={() => move(i, -1)} disabled={i === 0} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 px-1">↑</button>
              <button onClick={() => move(i, 1)} disabled={i === maps.length - 1} className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20 px-1">↓</button>
              <button onClick={() => remove(i)} className="text-zinc-600 hover:text-red-400 px-1">×</button>
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
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/70"
          >
            {VANILLA_MAPS.map((id) => <option key={id} value={id}>{displayName(id)}</option>)}
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
            placeholder="Custom map folder name (e.g. Wake_Island_2142)"
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-amber-500/70"
          />
          <button
            type="button"
            onClick={addMap}
            disabled={!customMap.trim()}
            className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs rounded-lg transition-colors whitespace-nowrap"
          >
            + Custom
          </button>
        </div>
      </div>
    </div>
  )
}
