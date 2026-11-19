import { once } from "node:events";
import { createServer } from "node:http";
import { buildApp } from "./app.js";
import { envConfig } from "./config/envConfig.js";
import { prisma } from "./config/prisma.js";

async function start() {
  if (!envConfig.DB_URI) {
    throw new Error("DATABASE_URL is required to connect to PostgreSQL");
  }

  const app = buildApp();
  await prisma.$connect();
  console.info("Postgres connected");

  const server = createServer(app);
  server.listen(envConfig.PORT, "localhost");
  await once(server, "listening");
  console.info(`Running http://localhost:${envConfig.PORT}`);

  function shutdown() {
    // Finish active requests before closing the database connection.
    server.close((error) => {
      if (error) {
        console.error(error);
        process.exitCode = 1;
      }
      prisma.$disconnect().catch((error) => {
        console.error(error);
        process.exitCode = 1;
      });
    });
  }
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

start().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
  await prisma.$disconnect();
});
