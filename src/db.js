import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

export function createPrismaClient(connectionString) {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

// Prisma throws this error code when the row to update or delete does not exist
const NOT_FOUND = 'P2025';

// All database queries live here, so the rest of the app never uses Prisma directly
export function createDb(prisma) {
  return {
    ping() {
      return prisma.$queryRaw`SELECT 1`;
    },

    list(search = '') {
      return prisma.transcription.findMany({
        where: {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { text: { contains: search, mode: 'insensitive' } },
          ],
        },
        orderBy: { id: 'desc' },
        take: 100,
      });
    },

    get(id) {
      return prisma.transcription.findUnique({ where: { id: Number(id) } });
    },

    create(data) {
      return prisma.transcription.create({ data });
    },

    async update(id, data) {
      try {
        return await prisma.transcription.update({ where: { id: Number(id) }, data });
      } catch (err) {
        if (err.code === NOT_FOUND) return null;
        throw err;
      }
    },

    async remove(id) {
      try {
        await prisma.transcription.delete({ where: { id: Number(id) } });
        return true;
      } catch (err) {
        if (err.code === NOT_FOUND) return false;
        throw err;
      }
    },
  };
}
