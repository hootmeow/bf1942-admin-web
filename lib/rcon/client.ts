/**
 * BF1942 RCON client — Refractor 1 engine, TCP.
 *
 * Protocol (from CVE-2003-1355 and icculus.org BF1942 mailing list, Feb 2003):
 *
 *   1. TCP connect to rconPort (default 4711)
 *   2. SERVER → CLIENT: 10-byte XOR key
 *   3. CLIENT → SERVER: uint32LE(usernameLen) + xor(username, key)
 *                     + uint32LE(passwordLen)  + xor(password,  key)
 *   4. SERVER → CLIENT: 0x01 = auth OK, anything else = fail
 *   5. After auth: plain text, newline-delimited.
 *      Server mirrors console output prefixed with '#'.
 *      Commands are raw console commands, e.g. "game.listPlayers\n"
 *
 * Username/password constraint: must be pure alphanumeric — all-letters OR all-digits.
 * Mixed strings (letters+digits) will be rejected by the server with "Unauthorized".
 *
 * Known bug: enabling remote console causes the server to hang on map changes.
 * Reconnect after a map change if you observe loss of output.
 */

import { EventEmitter } from 'events'
import * as net from 'net'
import { parsePlayerList, parseConsoleEvent } from './parser'
import type { RconConnectionOptions, RconPlayer, ParsedConsoleEvent } from './types'

type Phase = 'disconnected' | 'awaiting_key' | 'awaiting_auth' | 'authenticated'

function xorEncode(data: Buffer, key: Buffer): Buffer {
  const out = Buffer.allocUnsafe(data.length)
  for (let i = 0; i < data.length; i++) {
    out[i] = data[i] ^ key[i % key.length]
  }
  return out
}

/**
 * Emits:
 *   'authenticated'                  — auth succeeded
 *   'console'  (event: ParsedConsoleEvent) — parsed console event
 *   'players'  (players: RconPlayer[])    — result of requestPlayerList()
 *   'error'    (err: Error)
 *   'disconnect'
 */
export class BF1942RconClient extends EventEmitter {
  private socket: net.Socket | null = null
  private phase: Phase = 'disconnected'
  private xorKey = Buffer.alloc(0)
  /** Accumulates bytes during the binary auth phase */
  private binBuf = Buffer.alloc(0)
  /** Accumulates text during the authenticated phase */
  private textBuf = ''

  private authResolve: (() => void) | null = null
  private authReject: ((e: Error) => void) | null = null

  /** Lines accumulated while waiting for a listPlayers response */
  private playerLineBuf: string[] = []
  private collectingPlayers = false
  private playerListTimer: ReturnType<typeof setTimeout> | null = null

  private readonly opts: RconConnectionOptions

  constructor(opts: RconConnectionOptions) {
    super()
    this.opts = opts
  }

  connect(): Promise<void> {
    if (this.phase !== 'disconnected') {
      return Promise.reject(new Error('Already connected or connecting'))
    }

    return new Promise((resolve, reject) => {
      this.authResolve = resolve
      this.authReject = reject
      this.phase = 'awaiting_key'
      this.binBuf = Buffer.alloc(0)
      this.textBuf = ''

      const sock = new net.Socket()
      this.socket = sock

      sock.on('data', (chunk: Buffer) => this.onData(chunk))

      sock.on('error', (err: Error) => {
        this.emit('error', err)
        if (this.authReject) {
          this.authReject(err)
          this.authResolve = null
          this.authReject = null
        }
      })

      sock.on('close', () => {
        this.phase = 'disconnected'
        if (this.playerListTimer) {
          clearTimeout(this.playerListTimer)
          this.playerListTimer = null
        }
        this.emit('disconnect')
      })

      sock.connect(this.opts.rconPort, this.opts.host)
    })
  }

  private onData(chunk: Buffer): void {
    if (this.phase === 'awaiting_key' || this.phase === 'awaiting_auth') {
      this.binBuf = Buffer.concat([this.binBuf, chunk])
      this.drainBinaryPhase()
    } else if (this.phase === 'authenticated') {
      // Use latin1 so we don't mangle bytes — BF1942 is mid-2000s Windows, may have CP1252
      this.textBuf += chunk.toString('latin1')
      this.drainTextLines()
    }
  }

  private drainBinaryPhase(): void {
    // Phase 1: wait for 10-byte XOR key
    if (this.phase === 'awaiting_key') {
      if (this.binBuf.length < 10) return
      this.xorKey = Buffer.from(this.binBuf.subarray(0, 10))
      this.binBuf = this.binBuf.subarray(10)
      this.sendCredentials()
      this.phase = 'awaiting_auth'
    }

    // Phase 2: wait for 1-byte auth response
    if (this.phase === 'awaiting_auth') {
      if (this.binBuf.length < 1) return
      const authByte = this.binBuf[0]
      const leftover = this.binBuf.subarray(1)
      this.binBuf = Buffer.alloc(0)

      if (authByte === 0x01) {
        this.phase = 'authenticated'
        const resolve = this.authResolve!
        this.authResolve = null
        this.authReject = null
        resolve()
        this.emit('authenticated')

        // Any bytes that arrived alongside the auth byte are text
        if (leftover.length > 0) {
          this.textBuf += leftover.toString('latin1')
          this.drainTextLines()
        }
      } else {
        this.phase = 'disconnected'
        const reject = this.authReject!
        this.authResolve = null
        this.authReject = null
        this.socket?.destroy()
        reject(new Error('RCON authentication failed — check username/password and that the account is alphanumeric-only'))
      }
    }
  }

  private sendCredentials(): void {
    const userBytes = Buffer.from(this.opts.username, 'latin1')
    const passBytes = Buffer.from(this.opts.password, 'latin1')

    const encodedUser = xorEncode(userBytes, this.xorKey)
    const encodedPass = xorEncode(passBytes, this.xorKey)

    const lenU = Buffer.allocUnsafe(4)
    const lenP = Buffer.allocUnsafe(4)
    lenU.writeUInt32LE(userBytes.length, 0)
    lenP.writeUInt32LE(passBytes.length, 0)

    this.socket!.write(Buffer.concat([lenU, encodedUser, lenP, encodedPass]))
  }

  private drainTextLines(): void {
    const parts = this.textBuf.split('\n')
    this.textBuf = parts.pop() ?? '' // last part has no trailing \n yet

    for (const raw of parts) {
      const line = raw.replace(/\r$/, '') // strip Windows \r
      if (!line) continue

      // All server output arrives prefixed with '#'
      const content = line.startsWith('#') ? line.slice(1) : line

      if (this.collectingPlayers) {
        this.playerLineBuf.push(content)
      }

      const event = parseConsoleEvent(content)
      this.emit('console', event)
    }
  }

  sendCommand(command: string): void {
    if (this.phase !== 'authenticated') throw new Error('Not authenticated')
    this.socket!.write(`${command}\n`)
  }

  /**
   * Sends `game.listPlayers`, collects the response lines for `timeoutMs`,
   * then parses and returns the player array.
   *
   * The player list output format isn't officially documented — if this returns
   * empty on a live server, log the raw console lines and adjust parser.ts.
   */
  requestPlayerList(timeoutMs = 1000): Promise<RconPlayer[]> {
    return new Promise((resolve) => {
      if (this.playerListTimer) clearTimeout(this.playerListTimer)
      this.playerLineBuf = []
      this.collectingPlayers = true

      this.playerListTimer = setTimeout(() => {
        this.collectingPlayers = false
        const players = parsePlayerList(this.playerLineBuf)
        this.playerLineBuf = []
        this.playerListTimer = null
        this.emit('players', players)
        resolve(players)
      }, timeoutMs)

      try {
        this.sendCommand('game.listPlayers')
      } catch {
        this.collectingPlayers = false
        resolve([])
      }
    })
  }

  disconnect(): void {
    if (this.playerListTimer) {
      clearTimeout(this.playerListTimer)
      this.playerListTimer = null
    }
    this.socket?.destroy()
    this.socket = null
    this.phase = 'disconnected'
  }

  get isAuthenticated(): boolean { return this.phase === 'authenticated' }
  get isConnected(): boolean { return this.phase !== 'disconnected' }
}
