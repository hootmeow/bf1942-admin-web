import type { Server as HttpServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents, ProcessStatus } from '@/types/socket'
import { db } from '@/lib/db/index'
import { ensureManager } from '@/lib/process/registry'
import type { RconPlayer } from '@/lib/rcon/types'

type IO = SocketIOServer<ClientToServerEvents, ServerToClientEvents>

let io: IO | null = null

export function initSocketServer(httpServer: HttpServer): IO {
  if (io) return io

  io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    path: '/socket.io',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    socket.on('join-server', async (serverId) => {
      socket.join(`server:${serverId}`)

      try {
        const id = parseInt(serverId)
        const server = await db.server.findUnique({
          where: { id },
          select: { binaryPath: true, gameDir: true },
        })
        if (server) {
          const mgr = await ensureManager(id)
          // Send current status immediately to the joining client
          socket.emit('process-status', mgr.getStatus())
        }
      } catch (err) {
        console.error(`[Socket] Error attaching manager for server ${serverId}:`, (err as Error).message)
      }
    })

    socket.on('leave-server', (serverId) => {
      socket.leave(`server:${serverId}`)
    })
  })

  return io
}

export function getIO(): IO {
  if (!io) throw new Error('Socket.io server not initialized')
  return io
}

export function broadcastConsoleLine(serverId: number, line: string): void {
  try { getIO().to(`server:${serverId}`).emit('console-line', line) } catch {}
}

export function broadcastPlayers(serverId: number, players: RconPlayer[]): void {
  try { getIO().to(`server:${serverId}`).emit('players-update', players) } catch {}
}

export function broadcastProcessStatus(serverId: number, status: ProcessStatus): void {
  try { getIO().to(`server:${serverId}`).emit('process-status', status) } catch {}
}
