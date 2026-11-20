import dotenv from "dotenv"

dotenv.config();
export const envConfig = {
    PORT: Number(process.env.PORT ?? 8080),
    RAIL_API: process.env.RAIL_API,
    DB_URI: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    GEMINI_API_KEY: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY,
    GEMINI_CHAT_MODEL: process.env.GEMINI_CHAT_MODEL,
}
