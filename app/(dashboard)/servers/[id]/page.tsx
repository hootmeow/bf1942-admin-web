import { notFound } from 'next/navigation'
import { db } from '@/lib/db/index'
import { ServerDashboard } from '@/components/ServerDashboard'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ServerPage({ params }: Props) {
  const { id } = await params
  const server = await db.server.findUnique({
    where: { id: parseInt(id) },
    select: { id: true, name: true, host: true, port: true },
  })

  if (!server) notFound()

  return <ServerDashboard server={server} />
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const server = await db.server.findUnique({
    where: { id: parseInt(id) },
    select: { name: true },
  })
  return { title: server ? `${server.name} — BF1942 Admin` : 'Server — BF1942 Admin' }
}
