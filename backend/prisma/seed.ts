import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const ticketTypes = [
  { slug: 'student', name: 'Student', detail: 'Affordable access for students to experience the festival.', priceMinor: 40_000 },
  { slug: 'regular', name: 'Regular', detail: 'Full access to the Grand Northerners Festival experience.', priceMinor: 50_000 },
  { slug: 'vip', name: 'VIP', detail: 'Premium access for an elevated festival experience.', priceMinor: 200_000 },
  { slug: 'vvip', name: 'VVIP', detail: 'Exclusive access and the most premium festival experience.', priceMinor: 500_000 },
]

async function main() {
  for (const ticketType of ticketTypes) {
    await prisma.ticketType.upsert({
      where: { slug: ticketType.slug },
      update: ticketType,
      create: ticketType,
    })
  }
}

main()
  .catch((error: unknown) => {
    console.error('Ticket seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
