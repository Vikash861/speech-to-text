import { createPrismaClient, createDb } from './db.js';
import { createServer } from './app.js';

const prisma = createPrismaClient(process.env.DATABASE_URL);
const db = createDb(prisma);

const port = process.env.PORT ?? 3000;
createServer(db).listen(port, () => console.log(`Server running on http://localhost:${port}`));
