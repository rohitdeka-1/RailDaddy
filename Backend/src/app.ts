import Fastify from "fastify";
import prismaPlugin from "./plugins/prisma.js";

import authPlugin from "./plugins/auth.js";
import usersRoutes from "./modules/users/routes/users.routes.js";

export function buildApp() {
    const app = Fastify({
        logger: { redact: ["req.headers.authorization"] },
    })

    app.register(prismaPlugin);
    app.register(authPlugin);
    app.register(usersRoutes, { prefix: "/api/v1/users" });

    app.get("/health", async function healthCheck() {
        return {
            status: "ok",
            service: "RailDaddy-Backend"
        }
    })

    return app;
}
