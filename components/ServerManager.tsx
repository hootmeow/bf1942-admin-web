'use client'

import { useState } from 'react'

interface ServerRow {
  id: number
  name: string
  host: string
  port: number
  rconPort: number
  rconUser: string
}

interface FormState {
  name: string
  host: string
  port: string
  rconPort: string
  rconUser: string
  rconPass: string
}

const EMPTY_FORM: FormState = {
  name: '',
  host: '',
  port: '14567',
  rconPort: '4711',
  rconUser: '',
  rconPass: '',
}

export function ServerManager({ initialServers }: { initialServers: ServerRow[] }) {
  const [servers, setServers] = useState(initialServers)
  const [mode, setMode] = useState<'idle' | 'add' | { edit: ServerRow }>('idle')
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function openAdd() {
    setForm(EMPTY_FORM)
    setError('')
    setMode('add')
  }

  function openEdit(server: ServerRow) {
    setForm({
      name: server.name,
      host: server.host,
      port: String(server.port),
      rconPort: String(server.rconPort),
      rconUser: server.rconUser,
      rconPass: '',
    })
    setError('')
    setMode({ edit: server })
  }

  function cancel() {
    setMode('idle')
    setError('')
  }

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    try {
      if (mode === 'add') {
        const res = await fetch('/api/servers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'Failed to create server'); return }
        setServers((s) => [...s, data].sort((a, b) => a.name.localeCompare(b.name)))
        setMode('idle')
      } else if (typeof mode === 'object') {
        const body: Partial<FormState> = { ...form }
        if (!body.rconPass) delete body.rconPass // don't overwrite with blank
        const res = await fetch(`/api/servers/${mode.edit.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) { setError(data.error ?? 'Failed to update server'); return }
        setServers((s) =>
          s.map((sv) => sv.id === mode.edit.id ? { ...sv, ...data } : sv)
           .sort((a, b) => a.name.localeCompare(b.name))
        )
        setMode('idle')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(server: ServerRow) {
    if (!confirm(`Delete "${server.name}"? This cannot be undone.`)) return
    const res = await fetch(`/api/servers/${server.id}`, { method: 'DELETE' })
    if (res.ok) {
      setServers((s) => s.filter((sv) => sv.id !== server.id))
      if (typeof mode === 'object' && mode.edit.id === server.id) setMode('idle')
    }
  }

  const isFormOpen = mode !== 'idle'
  const editingId = typeof mode === 'object' ? mode.edit.id : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">Game Servers</h3>
        {!isFormOpen && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold rounded-lg transition-colors"
          >
            + Add Server
          </button>
        )}
      </div>

      {/* Server list */}
      {servers.length === 0 && !isFormOpen ? (
        <div className="border border-dashed border-zinc-800 rounded-xl py-10 text-center">
          <p className="text-sm text-zinc-600">No servers yet.</p>
          <button onClick={openAdd} className="mt-2 text-xs text-amber-500 hover:text-amber-400">
            Add your first server →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map((server) => (
            <div
              key={server.id}
              className={`flex items-center gap-3 bg-zinc-900 border rounded-xl px-4 py-3 transition-colors ${
                editingId === server.id ? 'border-amber-500/40' : 'border-zinc-800'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200 truncate">{server.name}</p>
                <p className="text-xs text-zinc-600 font-mono mt-0.5">
                  {server.host}:{server.port} · RCON :{server.rconPort}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => openEdit(server)}
                  className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors px-2 py-1 hover:bg-zinc-800 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(server)}
                  className="text-xs text-zinc-500 hover:text-red-400 transition-colors px-2 py-1 hover:bg-zinc-800 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit form */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4"
        >
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            {mode === 'add' ? 'Add Server' : 'Edit Server'}
          </h4>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Display Name" span={2}>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="My BF1942 Server"
                required
                className={inputCls}
              />
            </Field>

            <Field label="Host / IP Address" span={2}>
              <input
                type="text"
                value={form.host}
                onChange={(e) => set('host', e.target.value)}
                placeholder="192.168.1.10"
                required
                className={inputCls}
              />
            </Field>

            <Field label="Game Port">
              <input
                type="number"
                value={form.port}
                onChange={(e) => set('port', e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="RCON Port">
              <input
                type="number"
                value={form.rconPort}
                onChange={(e) => set('rconPort', e.target.value)}
                className={inputCls}
              />
            </Field>

            <Field label="RCON Username">
              <input
                type="text"
                value={form.rconUser}
                onChange={(e) => set('rconUser', e.target.value)}
                placeholder="admin"
                className={inputCls}
                autoComplete="off"
              />
            </Field>

            <Field
              label={mode === 'add' ? 'RCON Password' : 'RCON Password (leave blank to keep)'}
            >
              <input
                type="password"
                value={form.rconPass}
                onChange={(e) => set('rconPass', e.target.value)}
                placeholder={mode === 'add' ? 'required' : '••••••••'}
                required={mode === 'add'}
                className={inputCls}
                autoComplete="new-password"
              />
            </Field>
          </div>

          <p className="text-xs text-zinc-600">
            RCON username and password must be all-letters or all-digits — no mixed alphanumeric, no spaces. This is a BF1942 server requirement.
          </p>

          {error && (
            <div className="bg-red-950/40 border border-red-800/40 rounded-lg px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-semibold rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : mode === 'add' ? 'Add Server' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

const inputCls =
  'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30 transition-colors'

function Field({
  label,
  children,
  span,
}: {
  label: string
  children: React.ReactNode
  span?: number
}) {
  return (
    <div className={span === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-zinc-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
