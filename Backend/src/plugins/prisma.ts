import { envConfig } from "../config/envConfig.js";
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../generated/prisma/index.js";
import { prisma } from "../config/prisma.js";

declare module "fastify" {
    interface FastifyInstance {
        prisma: PrismaClient;
    }
}

async function prismaPlugin(app: FastifyInstance) {
    const connectionString = envConfig.DB_URI;
    if (!connectionString) {
        throw new Error("DATABASE_URL is required to connect to PostgreSQL");
    }

    try {
        await prisma.$connect();
        app.log.info("Postgres connected");
    } catch (error) {
        app.log.error(error);
        await prisma.$disconnect();
        throw error;
    }

    app.decorate("prisma", prisma);
    //Plugin gives Fastify one Prisma client to reuse across requests,
    app.addHook("onClose", async function disconnectDatabase() {
        await prisma.$disconnect();
    });
    //Lifecycle Event , like on close disconnect the client
}

export default fp(prismaPlugin, { name: "prisma", fastify: "5.x" });
