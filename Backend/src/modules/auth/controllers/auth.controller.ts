import type { Request, Response } from "express";
import { clearSessionCookie, setSessionCookie } from "../../../middleware/auth.js";
import { loginForm, signupForm } from "../auth.schemas.js";
import { createAccount, checkCredentials } from "../services/auth.service.js";

export async function signup(req: Request, res: Response) {
  // safeParse checks the form and gives us either validated data or an error.
  const form = signupForm.safeParse(req.body);
  if (!form.success) {
    return res.status(400).json({ message: form.error.issues[0]?.message });
  }

  const user = await createAccount(req.app.locals.database, form.data);
  if (!user) {
    return res.status(409).json({ message: "An account with that email already exists." });
  }

  setSessionCookie(res, user.id, req.app.locals.jwtSecret);
  return res.status(201).end();
}

export async function login(req: Request, res: Response) {
  const form = loginForm.safeParse(req.body);
  if (!form.success) {
    return res.status(400).json({ message: form.error.issues[0]?.message });
  }

  const user = await checkCredentials(req.app.locals.database, form.data);
  if (!user) {
    return res.status(401).json({ message: "Incorrect email or password." });
  }

  setSessionCookie(res, user.id, req.app.locals.jwtSecret);
  return res.status(204).end();
}

export function logout(_req: Request, res: Response) {
  clearSessionCookie(res);
  res.status(204).end();
}
