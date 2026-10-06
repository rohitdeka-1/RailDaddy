import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/index.js";
import { envConfig } from "./envConfig.js";

const adapter = new PrismaPg({
  connectionString: envConfig.DB_URI,
  connectionTimeoutMillis: 5000,
});

// All repositories and the Fastify plugin share this client.
export const prisma = new PrismaClient({ adapter: adapter });
