'use client'

import { useState, useEffect } from 'react'
import { io, Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@/types/socket'
import type { RconPlayer } from '@/lib/rcon/types'
import { Console } from './Console'
import { PlayerList } from './PlayerList'
import { MapRotationEditor } from './MapRotationEditor'
import { BanList } from './BanList'

type Tab = 'console' | 'players' | 'maps' | 'bans'

interface Server {
  id: number
  name: string
  host: string
  port: number
}

export function ServerDashboard({ server }: { server: Server }) {
  const [tab, setTab] = useState<Tab>('console')
  const [connected, setConnected] = useState(false)
  const [lines, setLines] = useState<string[]>([])
  const [players, setPlayers] = useState<RconPlayer[]>([])

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ path: '/socket.io' })

    socket.on('connect', () => {
      setConnected(true)
      socket.emit('join-server', String(server.id))
    })

    socket.on('disconnect', () => setConnected(false))

    socket.on('console-line', (line) => {
      setLines((prev) => [...prev.slice(-999), line])
    })

    socket.on('players-update', (list) => setPlayers(list))

    return () => {
      socket.emit('leave-server', String(server.id))
      socket.disconnect()
    }
  }, [server.id])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'console', label: 'Console' },
    { key: 'players', label: players.length ? `Players (${players.length})` : 'Players' },
    { key: 'maps', label: 'Map Rotation' },
    { key: 'bans', label: 'Bans' },
  ]

  async function sendCommand(command: string) {
    await fetch(`/api/servers/${server.id}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    })
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">{server.name}</h2>
          <p className="text-xs text-zinc-600 font-mono mt-0.5">{server.host}:{server.port}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full transition-colors ${connected ? 'bg-emerald-500' : 'bg-zinc-700'}`} />
          <span className="text-xs text-zinc-500">{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Tab bar */}
      <div className="shrink-0 flex border-b border-zinc-800 px-6">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'console' && <Console lines={lines} onCommand={sendCommand} />}
        {tab === 'players' && <PlayerList players={players} serverId={server.id} />}
        {tab === 'maps' && <MapRotationEditor serverId={server.id} />}
        {tab === 'bans' && <BanList serverId={server.id} />}
      </div>
    </div>
  )
}
