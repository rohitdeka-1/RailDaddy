import { prisma } from "../../../config/prisma.js";
import { Prisma } from "../../../generated/prisma/index.js";
import type { User } from "../../../generated/prisma/index.js";

import type { UpdateProfileInput } from "../users.schemas.js";

export interface UserRepository {
  findByCognitoSub(cognitoSub: string): Promise<User | null>;
  save(cognitoSub: string, data: UpdateProfileInput): Promise<User>;
}

export class UsersRepository implements UserRepository {

  async findByCognitoSub(cognitoSub: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { cognitoSub: cognitoSub },
    });
    return user;
  }

  async findOrCreate(cognitoSub: string): Promise<User> {
    try {
      return await prisma.user.upsert({
        where: { cognitoSub: cognitoSub },
        create: { cognitoSub: cognitoSub },
        // Authentication must not change an existing profile.
        update: {},
      });
    } catch (error) {
      // Another first request may have created this user concurrently.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const user = await this.findByCognitoSub(cognitoSub);
        if (user) {
          return user;
        }
      }
      throw error;
    }
  }

  async save(cognitoSub: string, data: UpdateProfileInput): Promise<User> {
    const preferences = data.preferences !== undefined ? (data.preferences === null ? Prisma.DbNull : data.preferences) : undefined;

    const user = await prisma.user.upsert({
      where: { cognitoSub: cognitoSub },
      create: {
        cognitoSub: cognitoSub,
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.preferences !== undefined && {
          preferences: data.preferences === null ? Prisma.DbNull : data.preferences as Prisma.InputJsonValue
        })
      },
      update: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.preferences !== undefined && {
          preferences: data.preferences === null ? Prisma.DbNull : data.preferences as Prisma.InputJsonValue
        })
      },
    });
    return user;
  }

}
