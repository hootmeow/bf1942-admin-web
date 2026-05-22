import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import { parsePlayerList, parseConsoleEvent } from '../rcon/parser'
import type { RconPlayer } from '../rcon/types'

export interface ProcessOptions {
  binaryPath: string
  gameDir: string
  extraArgs?: string[]
}

export interface ProcessStatus {
  running: boolean
  pid?: number
  map: string
  playerCount: number
}

/**
 * Manages a BF1942 dedicated server process via stdin/stdout pipes.
 *
 * Emits (compatible with old BF1942RconClient):
 *   'authenticated'   — process started
 *   'console'         — ParsedConsoleEvent from stdout
 *   'players'         — RconPlayer[] result of requestPlayerList()
 *   'error'           — Error
 *   'disconnect'      — process exited
 *   'status-changed'  — ProcessStatus
 */
export class BF1942ProcessManager extends EventEmitter {
  private proc: ChildProcess | null = null
  private textBuf = ''
  private playerLineBuf: string[] = []
  private collectingPlayers = false
  private playerListTimer: ReturnType<typeof setTimeout> | null = null
  private _running = false
  private _pid: number | undefined
  private _map = ''
  private _playerCount = 0
  private pollTimer: ReturnType<typeof setInterval> | null = null

  constructor(private readonly opts: ProcessOptions) { super() }

  get isRunning(): boolean { return this._running }
  get isAuthenticated(): boolean { return this._running }
  get currentMap(): string { return this._map }

  getStatus(): ProcessStatus {
    return { running: this._running, pid: this._pid, map: this._map, playerCount: this._playerCount }
  }

  start(): Promise<void> {
    if (this._running) return Promise.resolve()

    return new Promise((resolve, reject) => {
      const args = [
        '+dedicated', '1',
        '+noSound', '1',
        '+fullscreen', '0',
        ...(this.opts.extraArgs ?? []),
      ]

      let proc: ChildProcess
      try {
        proc = spawn(this.opts.binaryPath, args, {
          cwd: this.opts.gameDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, LD_LIBRARY_PATH: this.opts.gameDir },
        })
      } catch (err) {
        reject(err as Error)
        return
      }

      this.proc = proc
      this._pid = proc.pid
      this._running = true

      let resolved = false
      const resolveOnce = () => { if (!resolved) { resolved = true; resolve() } }

      proc.on('error', (err: Error) => {
        this.emit('error', err)
        if (!resolved) { resolved = true; this._running = false; reject(err) }
      })

      proc.stdout?.setEncoding('utf8')
      proc.stdout?.on('data', (chunk: string) => {
        this.textBuf += chunk
        this.drainLines()
        resolveOnce()
      })

      proc.stderr?.setEncoding('utf8')
      proc.stderr?.on('data', (chunk: string) => {
        for (const raw of chunk.split('\n')) {
          const line = raw.trim()
          if (line) this.emit('console', parseConsoleEvent(line))
        }
      })

      proc.on('exit', () => {
        this._running = false
        this._pid = undefined
        this.proc = null
        if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
        this.emit('status-changed', this.getStatus())
        this.emit('disconnect')
        if (!resolved) { resolved = true; reject(new Error('Process exited before producing output')) }
      })

      // Resolve after 5s regardless (server may be slow to produce first output)
      setTimeout(resolveOnce, 5000)
    })
  }

  stop(): Promise<void> {
    if (!this._running || !this.proc) return Promise.resolve()
    return new Promise((resolve) => {
      const proc = this.proc!
      const forceTimer = setTimeout(() => { try { proc.kill('SIGKILL') } catch {} }, 10_000)
      proc.once('exit', () => { clearTimeout(forceTimer); resolve() })
      try { this.sendCommand('quit') } catch {}
    })
  }

  async restart(): Promise<void> {
    await this.stop()
    await new Promise(r => setTimeout(r, 1000))
    await this.start()
  }

  sendCommand(command: string): void {
    if (!this.proc?.stdin) throw new Error('Server not running')
    this.proc.stdin.write(command + '\n')
  }

  requestPlayerList(timeoutMs = 1500): Promise<RconPlayer[]> {
    return new Promise((resolve) => {
      if (!this._running) return resolve([])
      if (this.playerListTimer) clearTimeout(this.playerListTimer)
      this.playerLineBuf = []
      this.collectingPlayers = true
      this.playerListTimer = setTimeout(() => {
        this.collectingPlayers = false
        const players = parsePlayerList(this.playerLineBuf)
        this._playerCount = players.length
        this.playerLineBuf = []
        this.playerListTimer = null
        this.emit('players', players)
        resolve(players)
      }, timeoutMs)
      try {
        this.sendCommand('game.listPlayers')
      } catch {
        this.collectingPlayers = false
        if (this.playerListTimer) { clearTimeout(this.playerListTimer); this.playerListTimer = null }
        resolve([])
      }
    })
  }

  startPolling(intervalMs = 10_000): void {
    if (this.pollTimer) return
    if (this._running) this.requestPlayerList()
    this.pollTimer = setInterval(() => { if (this._running) this.requestPlayerList() }, intervalMs)
  }

  stopPolling(): void {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
  }

  disconnect(): void {
    this.stopPolling()
    if (this.proc) { try { this.proc.kill('SIGTERM') } catch {}; this.proc = null }
    this._running = false
  }

  private drainLines(): void {
    const parts = this.textBuf.split('\n')
    this.textBuf = parts.pop() ?? ''
    for (const raw of parts) {
      const line = raw.replace(/\r$/, '').trim()
      if (!line) continue

      // Detect map changes from common BF1942 console output patterns
      const mapM = line.match(/[Ll]oading level\s+(\S+)/) ??
        line.match(/[Ll]evel started[:\s]+(\S+)/) ??
        line.match(/[Cc]hanging\s+(?:to\s+)?level\s+(\S+)/)
      if (mapM && mapM[1]) {
        this._map = mapM[1]
        this.emit('status-changed', this.getStatus())
      }

      if (this.collectingPlayers) this.playerLineBuf.push(line)

      this.emit('console', parseConsoleEvent(line))
    }
  }
}
