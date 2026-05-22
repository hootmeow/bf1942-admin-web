import Link from 'next/link'
import { db } from '@/lib/db/index'

export default async function DashboardPage() {
  const servers = await db.server.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, host: true, port: true },
  })

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-semibold text-zinc-100">Servers</h2>
      </div>

      {servers.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-xl py-16 text-center">
          <p className="text-sm text-zinc-600">No servers configured.</p>
          <p className="text-xs text-zinc-700 mt-1">Add a server via the Settings page or directly in the database.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => (
            <Link
              key={server.id}
              href={`/servers/${server.id}`}
              className="group block bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition-all hover:shadow-lg hover:shadow-black/30"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-sm font-medium text-zinc-200 group-hover:text-amber-400 transition-colors">
                  {server.name}
                </h3>
                <span
                  className="mt-1 w-2 h-2 rounded-full bg-zinc-700 shrink-0"
                  title="Status unknown — RCON not connected"
                />
              </div>
              <p className="text-xs text-zinc-600 font-mono">{server.host}:{server.port}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
