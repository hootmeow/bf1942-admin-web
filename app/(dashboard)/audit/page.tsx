import Link from 'next/link'
import { db } from '@/lib/db/index'

export const metadata = { title: 'Audit Log — BF1942 Admin' }

const PAGE_SIZE = 50

const ACTION_LABELS: Record<string, string> = {
  kick: 'Kick',
  ban: 'Ban',
  unban: 'Unban',
  map_change: 'Map Change',
  map_rotation_update: 'Rotation Update',
  exec: 'Command',
  login: 'Login',
}

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function AuditPage({ searchParams }: Props) {
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1'))
  const skip = (page - 1) * PAGE_SIZE

  const [items, total] = await Promise.all([
    db.auditLog.findMany({
      skip,
      take: PAGE_SIZE,
      orderBy: { timestamp: 'desc' },
      include: {
        user: { select: { username: true } },
        server: { select: { name: true } },
      },
    }),
    db.auditLog.count(),
  ])

  const pages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-zinc-100">Audit Log</h2>
          <p className="text-xs text-zinc-500 mt-0.5">{total} total entries</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-zinc-600 text-sm">No audit entries yet.</div>
      ) : (
        <>
          <div className="overflow-auto rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900">
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">User</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Server</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {items.map((entry) => {
                  let detail = ''
                  try {
                    const parsed = JSON.parse(entry.detail)
                    if (parsed.command) detail = parsed.command
                    else if (parsed.playerName) detail = parsed.playerName + (parsed.reason ? ` — ${parsed.reason}` : '')
                    else if (parsed.maps) detail = `${parsed.maps.length} maps`
                  } catch {
                    detail = entry.detail
                  }

                  return (
                    <tr key={entry.id} className="hover:bg-zinc-900/40 transition-colors">
                      <td className="px-4 py-3 text-zinc-500 text-xs font-mono whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-zinc-300 text-xs">{entry.user.username}</td>
                      <td className="px-4 py-3 text-zinc-400 text-xs">{entry.server?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <ActionBadge action={entry.action} />
                      </td>
                      <td className="px-4 py-3 text-zinc-500 text-xs max-w-xs truncate">{detail}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="flex items-center justify-between mt-4 text-xs text-zinc-500">
              <span>Page {page} of {pages}</span>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link
                    href={`/audit?page=${page - 1}`}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
                  >
                    ← Previous
                  </Link>
                )}
                {page < pages && (
                  <Link
                    href={`/audit?page=${page + 1}`}
                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
                  >
                    Next →
                  </Link>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ActionBadge({ action }: { action: string }) {
  const label = ACTION_LABELS[action] ?? action
  const color =
    action === 'ban' ? 'text-red-400 bg-red-950/40 border-red-800/40' :
    action === 'kick' ? 'text-amber-400 bg-amber-950/40 border-amber-800/40' :
    action === 'unban' ? 'text-emerald-400 bg-emerald-950/40 border-emerald-800/40' :
    'text-zinc-400 bg-zinc-800/40 border-zinc-700/40'

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${color}`}>
      {label}
    </span>
  )
}
