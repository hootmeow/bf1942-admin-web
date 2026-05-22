'use client'

import { useState, useEffect } from 'react'

interface SettingDef {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'float'
  placeholder?: string
  help?: string
}

interface Section {
  title: string
  settings: SettingDef[]
}

const SECTIONS: Section[] = [
  {
    title: 'Server Info',
    settings: [
      { key: 'game.setservername', label: 'Server Name', type: 'string', placeholder: 'My BF1942 Server' },
      { key: 'game.setservermessage', label: 'Welcome Message', type: 'string', placeholder: 'Welcome!' },
      { key: 'game.setsponsortext', label: 'Sponsor Text', type: 'string' },
      { key: 'game.setsponsorlogourl', label: 'Sponsor Logo URL', type: 'string' },
      { key: 'game.setserverbanner', label: 'Server Banner URL', type: 'string' },
      { key: 'game.setinternet', label: 'Internet Server (visible in browser)', type: 'boolean' },
      { key: 'game.setserverpassword', label: 'Server Password', type: 'string', placeholder: 'leave blank for public' },
    ],
  },
  {
    title: 'Gameplay',
    settings: [
      { key: 'game.setmaxplayers', label: 'Max Players', type: 'number', placeholder: '64' },
      { key: 'game.setnumbotplayers', label: 'Bot Count', type: 'number', placeholder: '0' },
      { key: 'game.setnumroundspermap', label: 'Rounds Per Map', type: 'number', placeholder: '3' },
      { key: 'game.setticketratio', label: 'Ticket Ratio (%)', type: 'number', placeholder: '100', help: '100 = normal, 200 = double tickets' },
      { key: 'game.setgametime', label: 'Round Time Limit (min)', type: 'number', placeholder: '0', help: '0 = no limit' },
      { key: 'game.setteamratiopercent', label: 'Team Ratio (%)', type: 'number', placeholder: '100' },
      { key: 'game.setspawntime', label: 'Spawn Time (sec)', type: 'number', placeholder: '15' },
      { key: 'game.setspawndelay', label: 'Pre-Spawn Delay (sec)', type: 'number', placeholder: '15' },
      { key: 'game.setautobalance', label: 'Auto Balance Teams', type: 'boolean' },
      { key: 'game.setgamemode', label: 'Game Mode', type: 'string', placeholder: 'gpm_conquest' },
    ],
  },
  {
    title: 'Friendly Fire',
    settings: [
      { key: 'game.setfriendlyfire', label: 'Friendly Fire', type: 'boolean' },
      { key: 'game.setfriendlyfirewithmines', label: 'Friendly Fire with Mines', type: 'boolean' },
      { key: 'game.setkickback', label: 'Kickback Multiplier', type: 'float', placeholder: '1.0' },
      { key: 'game.setkickbackonsplash', label: 'Kickback on Splash', type: 'float', placeholder: '1.0' },
    ],
  },
  {
    title: 'Camera & Views',
    settings: [
      { key: 'game.setallownosecam', label: 'Allow Nose Cam', type: 'boolean' },
      { key: 'game.setfreecamera', label: 'Free Camera', type: 'boolean' },
      { key: 'game.setexternalviews', label: 'External Views', type: 'boolean' },
    ],
  },
  {
    title: 'Network',
    settings: [
      { key: 'game.setservergameplayport', label: 'Gameplay Port', type: 'number', placeholder: '14567' },
      { key: 'game.setserverinterface', label: 'Bind Interface IP', type: 'string', placeholder: 'leave blank for all interfaces' },
      { key: 'game.setvoipenabled', label: 'VOIP Enabled', type: 'boolean' },
      { key: 'game.setvoipserverport', label: 'VOIP Server Port', type: 'number', placeholder: '55123' },
    ],
  },
  {
    title: 'Admin',
    settings: [
      { key: 'admin.setadminpassword', label: 'Admin Password', type: 'string', placeholder: 'console admin password' },
      { key: '__rcon_user', label: 'RCON Username', type: 'string', placeholder: 'leave blank to disable RCON' },
      { key: '__rcon_pass', label: 'RCON Password', type: 'string', placeholder: '' },
    ],
  },
]

function parseRconFromSettings(settings: Record<string, string>): { user: string; pass: string } {
  const raw = settings['admin.enableremoteconsole'] ?? ''
  // format: "user" "pass"  or  user pass
  const m = raw.match(/^"([^"]*)"\s+"([^"]*)"$/) ?? raw.match(/^(\S+)\s+(\S+)$/)
  return m ? { user: m[1], pass: m[2] } : { user: '', pass: '' }
}

type Status = { type: 'ok' | 'err'; msg: string } | null

export function ServerSettings({ serverId }: { serverId: number }) {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [rconUser, setRconUser] = useState('')
  const [rconPass, setRconPass] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [openSection, setOpenSection] = useState<string>('Server Info')

  useEffect(() => {
    fetch(`/api/servers/${serverId}/settings`)
      .then(r => r.json())
      .then(data => {
        const s = data.settings ?? {}
        const rcon = parseRconFromSettings(s)
        setSettings(s)
        setRconUser(rcon.user)
        setRconPass(rcon.pass)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [serverId])

  function getValue(key: string): string {
    if (key === '__rcon_user') return rconUser
    if (key === '__rcon_pass') return rconPass
    return settings[key] ?? ''
  }

  function setValue(key: string, value: string) {
    if (key === '__rcon_user') { setRconUser(value); return }
    if (key === '__rcon_pass') { setRconPass(value); return }
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  async function save() {
    setSaving(true)
    setStatus(null)

    const payload = { ...settings }
    // Reconstruct admin.enableRemoteConsole
    if (rconUser) {
      payload['admin.enableremoteconsole'] = `"${rconUser}" "${rconPass}"`
    } else {
      payload['admin.enableremoteconsole'] = `"" ""`
    }

    try {
      const res = await fetch(`/api/servers/${serverId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: payload }),
      })
      const data = await res.json()
      if (res.ok) {
        setStatus({ type: 'ok', msg: 'Settings saved to serversettings.con. Restart the server to apply.' })
      } else {
        setStatus({ type: 'err', msg: data.error ?? 'Failed to save settings.' })
      }
    } catch {
      setStatus({ type: 'err', msg: 'Network error.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-zinc-600">Loading settings…</div>
  }

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">Server Settings</h3>
          <p className="text-xs text-zinc-600 mt-0.5">Edits serversettings.con directly. Restart server to apply.</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-semibold rounded-lg transition-colors"
        >
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      {status && (
        <p className={`text-xs ${status.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
          {status.msg}
        </p>
      )}

      {SECTIONS.map(section => (
        <div key={section.title} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-left"
            onClick={() => setOpenSection(s => s === section.title ? '' : section.title)}
          >
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{section.title}</span>
            <span className="text-zinc-600 text-xs">{openSection === section.title ? '▲' : '▼'}</span>
          </button>

          {openSection === section.title && (
            <div className="px-4 pb-4 space-y-3 border-t border-zinc-800">
              {section.settings.map(def => (
                <div key={def.key}>
                  <label className="block text-xs font-medium text-zinc-500 mb-1">
                    {def.label}
                    {def.help && <span className="font-normal text-zinc-700 ml-1">— {def.help}</span>}
                  </label>
                  {def.type === 'boolean' ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setValue(def.key, getValue(def.key) === '1' ? '0' : '1')}
                        className={`relative w-10 h-5 rounded-full transition-colors ${
                          getValue(def.key) === '1' ? 'bg-amber-500' : 'bg-zinc-700'
                        }`}
                      >
                        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                          getValue(def.key) === '1' ? 'translate-x-5' : 'translate-x-0.5'
                        }`} />
                      </button>
                      <span className="text-xs text-zinc-400">
                        {getValue(def.key) === '1' ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  ) : (
                    <input
                      type={def.type === 'number' || def.type === 'float' ? 'number' : def.key.includes('pass') ? 'password' : 'text'}
                      step={def.type === 'float' ? '0.01' : undefined}
                      value={getValue(def.key)}
                      onChange={e => setValue(def.key, e.target.value)}
                      placeholder={def.placeholder}
                      autoComplete={def.key.includes('pass') ? 'new-password' : undefined}
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-amber-500/70 focus:ring-1 focus:ring-amber-500/30 transition-colors"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
