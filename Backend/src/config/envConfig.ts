import dotenv from "dotenv"

dotenv.config();
export const envConfig = {
    PORT: Number(process.env.PORT),
    RAIL_API: process.env.RAIL_API,
    DB_URI: process.env.DATABASE_URL,
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID
}
