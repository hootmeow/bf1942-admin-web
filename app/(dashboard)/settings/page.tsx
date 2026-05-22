import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { db } from '@/lib/db/index'
import { ServerManager } from '@/components/ServerManager'

export const metadata = { title: 'Settings — BF1942 Admin' }

export default async function SettingsPage() {
  const user = await getAuthUser()
  if (!user || user.role !== 'admin') redirect('/dashboard')

  const servers = await db.server.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, host: true, port: true, rconPort: true, rconUser: true },
  })

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-base font-semibold text-zinc-100 mb-1">Settings</h2>
      <p className="text-xs text-zinc-500 mb-6">Manage game servers and their RCON credentials.</p>
      <ServerManager initialServers={servers} />
    </div>
  )
}
