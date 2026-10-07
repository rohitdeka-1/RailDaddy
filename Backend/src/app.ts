import Fastify from "fastify";
import prismaPlugin from "./plugins/prisma.js";

import authPlugin from "./plugins/auth.js";
import usersRoutes from "./modules/users/routes/users.routes.js";
import trainsRoutes from "./modules/trains/routes/trains.routes.js";
import journeyRoutes from "./modules/journey/routes/journey.routes.js";

export function buildApp() {
    const app = Fastify({
        logger: { redact: ["req.headers.authorization"] },
    })

    app.register(prismaPlugin);
    app.register(authPlugin);
    app.register(usersRoutes, { prefix: "/api/v1/users" });
    app.register(trainsRoutes, { prefix: "/api/v1/trains" });
    app.register(journeyRoutes, { prefix: "/api/v1/journey" });

    app.get("/health", async function healthCheck() {
        return {
            status: "ok",
            service: "RailDaddy-Backend"
        }
    })

    return app;
}
