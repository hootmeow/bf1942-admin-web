import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/auth'
import { LogoutButton } from '@/components/LogoutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex bg-zinc-950">
      <aside className="w-52 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="px-4 py-4 border-b border-zinc-800">
          <p className="text-xs font-semibold text-amber-500 tracking-[0.18em] uppercase">BF1942 Admin</p>
          <p className="text-xs text-zinc-600 mt-0.5 truncate">{user.username}</p>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          <SidebarLink href="/dashboard" label="Dashboard" />
          <SidebarLink href="/audit" label="Audit Log" />
          {user.role === 'admin' && <SidebarLink href="/settings" label="Settings" />}
        </nav>

        <div className="px-2 py-3 border-t border-zinc-800">
          <LogoutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

function SidebarLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-lg transition-colors"
    >
      {label}
    </Link>
  )
}
