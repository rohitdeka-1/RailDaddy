import { buildApp } from "./app.js";
import { envConfig } from "./config/envConfig.js";

const start = async () => {
    try {
        const app = buildApp();
        const PORT = envConfig.PORT;
        await app.listen({ port: PORT });
        app.log.info(`Running http://localhost:${PORT}`);

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}
start();