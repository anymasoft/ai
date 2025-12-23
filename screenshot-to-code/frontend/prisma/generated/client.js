// Mock Prisma Client for development
export const db = {
  user: {
    findUnique: () => null,
    findMany: () => [],
    create: () => ({ id: '1' }),
  },
  // Add other models as needed
};

export default db;
