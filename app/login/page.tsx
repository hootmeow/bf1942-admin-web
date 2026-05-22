'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        router.push('/dashboard')
      } else {
        const data = await res.json()
        setError(data.error ?? 'Authentication failed')
      }
    } catch {
      setError('Connection error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 mb-5">
            <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold tracking-[0.2em] text-zinc-100 uppercase">BF1942 Admin</h1>
          <p className="text-xs text-zinc-600 mt-1 tracking-widest uppercase">Server Management System</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30 transition-colors"
                placeholder="username"
                required
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30 transition-colors"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2 text-xs text-red-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-950 font-semibold text-sm py-2.5 rounded-lg transition-colors tracking-wider uppercase mt-2"
            >
              {loading ? 'Authenticating…' : 'Access System'}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-zinc-700 mt-6">
          Battlefield 1942 Remote Manager
        </p>
      </div>
    </div>
  )
}
