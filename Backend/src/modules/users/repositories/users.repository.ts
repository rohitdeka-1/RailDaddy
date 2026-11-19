import { prisma } from "../../../config/prisma.js";
import { Prisma } from "../../../generated/prisma/index.js";
import type { UpdateProfileInput } from "../users.schemas.js";

// Only these fields can leave the profile API.
const profileFields = {
  id: true,
  email: true,
  displayName: true,
  preferences: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const usersRepository = {
  findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: profileFields });
  },

  async save(id: string, input: UpdateProfileInput) {
    const { displayName, email, preferences } = input;
    try {
      return await prisma.user.update({
        where: { id },
        data: {
          displayName,
          ...(email !== undefined && { email }),
          ...(preferences !== undefined && { preferences: preferences ?? Prisma.DbNull }),
        },
        select: profileFields,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return null;
      }
      throw error;
    }
  }
};
