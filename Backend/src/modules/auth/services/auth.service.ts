import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { Prisma, type PrismaClient } from "../../../generated/prisma/index.js";
import type { LoginDetails, SignupDetails } from "../auth.schemas.js";

export async function createAccount(database: PrismaClient, details: SignupDetails) {
  const passwordHash = await hashPassword(details.password);
  try {
    return await database.user.create({
      data: { loginEmail: details.email, displayName: details.displayName, passwordHash },
      select: { id: true },
    });
  } catch (error) {
    // The unique email constraint also handles two signups at the same time.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return null;
    }
    throw error;
  }
}

export async function checkCredentials(database: PrismaClient, details: LoginDetails) {
  const user = await database.user.findUnique({
    where: { loginEmail: details.email },
    select: { id: true, passwordHash: true },
  });
  const matches = await passwordMatches(details.password, user?.passwordHash ?? null);
  if (!user || !matches) return null;
  return { id: user.id };
}

const keyLength = 64;

function passwordKey(password: string, salt: string): Promise<Buffer> {
  const options = {
    N: 32768,
    r: 8,
    p: 3,
    maxmem: 64 * 1024 * 1024,
  };
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await passwordKey(password, salt);
  return `${salt}:${key.toString("hex")}`;
}

async function passwordMatches(password: string, storedHash: string | null): Promise<boolean> {
  // Do the same amount of hashing work when the email doesn't exist.
  const [salt = "0".repeat(32), hash = "0".repeat(keyLength * 2)] = storedHash?.split(":") ?? [];
  const key = await passwordKey(password, salt);
  const matches = timingSafeEqual(key, Buffer.from(hash, "hex"));
  return storedHash !== null && matches;
}
