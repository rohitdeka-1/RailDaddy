import { prisma } from "../../../config/prisma.js";
import type { User } from "../../../generated/prisma/index.js";

// The service only needs these two database operations.
export interface UserRepository {
  findByCognitoSub(cognitoSub: string): Promise<User | null>;
  save(cognitoSub: string, displayName: string | null): Promise<User>;
}

export class UsersRepository implements UserRepository {
  async findByCognitoSub(cognitoSub: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { cognitoSub: cognitoSub },
    });
    return user;
  }

  async save(cognitoSub: string, displayName: string | null): Promise<User> {
    // Upsert creates a missing user or updates an existing one in one operation.
    const user = await prisma.user.upsert({
      where: { cognitoSub: cognitoSub },
      create: { cognitoSub: cognitoSub, displayName: displayName },
      update: { displayName: displayName },
    });
    return user;
  }
}
