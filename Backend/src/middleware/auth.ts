import type { RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";

const sessionCookie = "rail_session";
const sessionLifetime = 60 * 60; // One hour, in seconds.
const issuer = "railsathi";
const cookieOptions = {
  path: "/api/v1",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
} as const;

declare global {
  namespace Express {
    interface Locals {
      userId?: string;
    }
  }
}

export function setSessionCookie(res: Response, userId: string, secret: string) {
  const token = jwt.sign({ sub: userId }, secret, {
    algorithm: "HS256",
    issuer,
    expiresIn: sessionLifetime,
  });
  res.cookie(sessionCookie, token, { ...cookieOptions, maxAge: sessionLifetime * 1000 });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(sessionCookie, cookieOptions);
}

export function requireAuth(secret: string): RequestHandler {
  return function authenticate(req, res, next) {
    res.set("Cache-Control", "no-store");
    const authorization = req.get("Authorization");
    const token = authorization
      ? /^Bearer\s+(\S+)$/i.exec(authorization)?.[1]
      : req.cookies[sessionCookie];

    if (typeof token === "string") {
      try {
        const claims = jwt.verify(token, secret, { algorithms: ["HS256"], issuer });
        // Save the verified user ID for the profile handler.
        if (typeof claims !== "string" && typeof claims.sub === "string" && claims.sub && typeof claims.exp === "number") {
          res.locals.userId = claims.sub;
        }
      } catch {
        // Invalid and expired tokens get the same response as a missing token.
      }
    }

    if (!res.locals.userId) {
      res.set("WWW-Authenticate", "Bearer").status(401).json({ message: "Please sign in." });
      return;
    }
    next();
  };
}
