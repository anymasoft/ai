// Mock Prisma Client for development/MOCKS mode

// Mock PrismaClient class
export class PrismaClient {
  user = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async () => ({ id: '1' }),
    update: async () => ({ id: '1' }),
    delete: async () => ({ id: '1' }),
  };

  organization = {
    findUnique: async () => null,
    findMany: async () => [],
    create: async () => ({ id: '1' }),
    update: async () => ({ id: '1' }),
    delete: async () => ({ id: '1' }),
  };

  $connect = async () => {};
  $disconnect = async () => {};
  $extends = (extension: any) => new PrismaClient();
  $transaction = async (callback: any) => callback(this);
}

// Mock Prisma namespace
export const Prisma = {
  defineExtension: (extension: any) => extension,
};

export default new PrismaClient();
