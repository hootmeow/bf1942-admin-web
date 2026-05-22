import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  const admin = await db.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: await hash('changeme', 12),
      role: 'admin',
    },
  })
  console.log('Seeded admin user:', admin.username)
  console.log('Default password: changeme — change this immediately.')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
