import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/app.js";
import { envConfig } from "../src/config/envConfig.js";
import jwt from "jsonwebtoken";
import request from "supertest";
import { Prisma } from "../src/generated/prisma/index.js";
import type { PrismaClient } from "../src/generated/prisma/index.js";
import { usersRepository } from "../src/modules/users/repositories/users.repository.js";

test("signup and login issue a JWT cookie, and only a valid session can read a profile", async (context) => {
  const secret = "test-only-signing-secret-at-least-32-bytes";
  const accounts = new Map<string, { id: string; displayName: string; passwordHash: string }>();
  async function create({
    data,
  }: { data: { loginEmail: string; displayName: string; passwordHash: string } }) {
    if (accounts.has(data.loginEmail)) {
      throw new Prisma.PrismaClientKnownRequestError("Duplicate email", {
        code: "P2002",
        clientVersion: Prisma.prismaVersion.client,
      });
    }
    const account = { id: "user-a", displayName: data.displayName, passwordHash: data.passwordHash };
    accounts.set(data.loginEmail, account);
    return { id: account.id };
  }
  const findProfile = context.mock.method(usersRepository, "findById", async (id: string) => {
    const account = [...accounts.values()].find((user) => user.id === id);
    return account ? { id, displayName: account.displayName } : null;
  });

  const database = {
    user: {
      create,
      findUnique: async ({ where }: { where: { loginEmail: string } }) => accounts.get(where.loginEmail) ?? null,
    },
  } as unknown as PrismaClient;
  const originalSecret = envConfig.JWT_SECRET;
  envConfig.JWT_SECRET = secret;
  context.after(() => { envConfig.JWT_SECRET = originalSecret; });
  const client = request(buildApp(database));

  const profilePath = "/api/v1/users/me";
  const expiredToken = jwt.sign({ sub: "user-a" }, secret, { issuer: "railsathi", expiresIn: -1 });
  await client.get(profilePath).expect(401);
  await client.get(profilePath).set("Cookie", "rail_session=invalid").expect(401);
  await client.get(profilePath).set("Authorization", `Bearer ${expiredToken}`).expect(401);
  assert.equal(findProfile.mock.callCount(), 0);

  const credentials = { email: "Rider@example.com", password: "a long test password" };
  const signup = (password: string) => client.post("/api/v1/auth/signup").send({
    ...credentials, password, displayName: "Rider",
  });
  await signup("short").expect(400);
  const created = await signup(credentials.password).expect(201);
  assert.notEqual(accounts.get("rider@example.com")?.passwordHash, credentials.password);
  await signup(credentials.password).expect(409);

  const session = created.get("Set-Cookie")?.[0] ?? "";
  assert.match(session, /HttpOnly/);
  assert.match(session, /SameSite=Lax/);
  assert.match(session, /Max-Age=3600/);
  const cookie = session.split(";")[0]!;
  const profile = await client.get(profilePath).set("Cookie", cookie).expect(200);
  assert.equal(profile.body.displayName, "Rider");
  assert.equal(profile.body.passwordHash, undefined);

  const token = cookie.slice("rail_session=".length);
  await client.get(profilePath).set("Authorization", `Bearer ${token}`).expect(200);

  const login = (password: string) => client.post("/api/v1/auth/login").send({
    email: " rider@example.com ", password,
  });
  await login("incorrect").expect(401);
  await login(credentials.password).expect(204);

  await client.post("/api/v1/auth/logout").expect(415);
  const logout = await client.post("/api/v1/auth/logout").set("Cookie", cookie).send({}).expect(204);
  assert.match(logout.get("Set-Cookie")?.[0] ?? "", /^rail_session=;/);
});
