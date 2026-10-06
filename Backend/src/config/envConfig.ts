import dotenv from "dotenv"

dotenv.config();
export const envConfig = {
    PORT: Number(process.env.PORT),
    RAIL_API: process.env.RAIL_API
}
