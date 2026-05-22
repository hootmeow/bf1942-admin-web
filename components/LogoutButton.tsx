'use client'

import { useRouter } from 'next/navigation'

export function LogoutButton() {
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <button
      onClick={handleLogout}
      className="w-full text-left px-3 py-2 text-xs text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
    >
      Sign out
    </button>
  )
}
