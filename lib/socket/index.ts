import type { Server as HttpServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@/types/socket'
import { connectServer } from '@/lib/rcon/registry'

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
      // Trigger RCON connection for this server if not already up
      try {
        await connectServer(parseInt(serverId))
      } catch (err) {
        console.error(`[Socket] Failed to connect RCON for server ${serverId}:`, (err as Error).message)
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
  getIO().to(`server:${serverId}`).emit('console-line', line)
}

export function broadcastPlayers(
  serverId: number,
  players: Parameters<ServerToClientEvents['players-update']>[0],
): void {
  getIO().to(`server:${serverId}`).emit('players-update', players)
}
