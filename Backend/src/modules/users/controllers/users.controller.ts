import type { Request, Response } from "express";
import { usersRepository } from "../repositories/users.repository.js";
import { updateProfileSchema } from "../users.schemas.js";

export async function getMe(_req: Request, res: Response) {
  if (!res.locals.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await usersRepository.findById(res.locals.userId);

  if (!user) {
    return res.status(404).json({ message: "Profile not found." });
  }

  return res.json(user);
}

export async function putMe(req: Request, res: Response) {
  if (!res.locals.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const parsed = updateProfileSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid profile", issues: parsed.error.issues });
  }

  const user = await usersRepository.save(res.locals.userId, parsed.data);
  if (!user) {
    return res.status(404).json({ message: "Profile not found." });
  }

  return res.json(user);
}
