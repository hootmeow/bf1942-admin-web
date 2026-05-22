'use client'

import { useState, useEffect, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents, ProcessStatus } from '@/types/socket'
import type { RconPlayer } from '@/lib/rcon/types'
import { Console } from './Console'
import { PlayerList } from './PlayerList'
import { MapRotationEditor } from './MapRotationEditor'
import { BanList } from './BanList'
import { ServerSettings } from './ServerSettings'

type Tab = 'console' | 'players' | 'maps' | 'bans' | 'settings'

interface Server {
  id: number
  name: string
  host: string
  port: number
}

export function ServerDashboard({ server }: { server: Server }) {
  const [tab, setTab] = useState<Tab>('console')
  const [socketConnected, setSocketConnected] = useState(false)
  const [lines, setLines] = useState<string[]>([])
  const [players, setPlayers] = useState<RconPlayer[]>([])
  const [procStatus, setProcStatus] = useState<ProcessStatus>({
    running: false,
    map: '',
    playerCount: 0,
  })
  const [actionBusy, setActionBusy] = useState<'start' | 'stop' | 'restart' | null>(null)
  const [msgDraft, setMsgDraft] = useState('')
  const [msgBusy, setMsgBusy] = useState(false)

  useEffect(() => {
    const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io({ path: '/socket.io' })

    socket.on('connect', () => {
      setSocketConnected(true)
      socket.emit('join-server', String(server.id))
    })

    socket.on('disconnect', () => setSocketConnected(false))

    socket.on('console-line', (line) => {
      setLines((prev) => [...prev.slice(-999), line])
    })

    socket.on('players-update', (list) => {
      setPlayers(list)
      setProcStatus(prev => ({ ...prev, playerCount: list.length }))
    })

    socket.on('process-status', (status) => {
      setProcStatus(status)
    })

    return () => {
      socket.emit('leave-server', String(server.id))
      socket.disconnect()
    }
  }, [server.id])

  async function serverAction(action: 'start' | 'stop' | 'restart') {
    setActionBusy(action)
    try {
      await fetch(`/api/servers/${server.id}/${action}`, { method: 'POST' })
    } finally {
      setActionBusy(null)
    }
  }

  const sendCommand = useCallback(async (command: string) => {
    await fetch(`/api/servers/${server.id}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command }),
    })
  }, [server.id])

  async function broadcastMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!msgDraft.trim()) return
    setMsgBusy(true)
    try {
      await fetch(`/api/servers/${server.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msgDraft.trim() }),
      })
      setMsgDraft('')
    } finally {
      setMsgBusy(false)
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'console', label: 'Console' },
    { key: 'players', label: players.length ? `Players (${players.length})` : 'Players' },
    { key: 'maps', label: 'Map Rotation' },
    { key: 'bans', label: 'Bans' },
    { key: 'settings', label: 'Settings' },
  ]

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-zinc-800 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-zinc-100 truncate">{server.name}</h2>
          <p className="text-xs text-zinc-600 font-mono mt-0.5">{server.host}:{server.port}</p>
        </div>

        {/* Process status */}
        <div className="flex items-center gap-4 shrink-0">
          {procStatus.map && (
            <span className="hidden sm:block text-xs text-zinc-500 font-mono truncate max-w-[160px]" title={procStatus.map}>
              {procStatus.map}
            </span>
          )}

          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full transition-colors ${
              procStatus.running ? 'bg-emerald-500' : 'bg-zinc-700'
            }`} />
            <span className="text-xs text-zinc-500">
              {procStatus.running ? `Running${procStatus.pid ? ` (PID ${procStatus.pid})` : ''}` : 'Stopped'}
            </span>
          </div>

          {/* Server lifecycle buttons */}
          <div className="flex gap-1.5">
            {!procStatus.running ? (
              <button
                onClick={() => serverAction('start')}
                disabled={actionBusy !== null}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                {actionBusy === 'start' ? 'Starting…' : 'Start'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => serverAction('restart')}
                  disabled={actionBusy !== null}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {actionBusy === 'restart' ? 'Restarting…' : 'Restart'}
                </button>
                <button
                  onClick={() => serverAction('stop')}
                  disabled={actionBusy !== null}
                  className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {actionBusy === 'stop' ? 'Stopping…' : 'Stop'}
                </button>
              </>
            )}
          </div>

          {/* Socket connection dot */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-800">
            <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-blue-500' : 'bg-zinc-700'}`} />
            <span className="text-xs text-zinc-600">{socketConnected ? 'Live' : 'Connecting…'}</span>
          </div>
        </div>
      </div>

      {/* Broadcast message bar — shown when server is running */}
      {procStatus.running && (
        <form
          onSubmit={broadcastMessage}
          className="shrink-0 px-6 py-2 border-b border-zinc-800 flex gap-2 items-center bg-zinc-950"
        >
          <span className="text-xs text-zinc-600 shrink-0">Broadcast:</span>
          <input
            type="text"
            value={msgDraft}
            onChange={e => setMsgDraft(e.target.value)}
            placeholder="Send a message to all players…"
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-amber-500/50 transition-colors"
          />
          <button
            type="submit"
            disabled={msgBusy || !msgDraft.trim()}
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs rounded-lg transition-colors whitespace-nowrap"
          >
            {msgBusy ? '…' : 'Send'}
          </button>
        </form>
      )}

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
        {tab === 'settings' && <ServerSettings serverId={server.id} />}
      </div>
    </div>
  )
}
