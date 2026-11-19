import type { User } from "../src/generated/prisma/index.js";
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { getMe, putMe } from '../src/modules/users/controllers/users.controller.js';
import { usersRepository } from '../src/modules/users/repositories/users.repository.js';
import type { UpdateProfileInput } from '../src/modules/users/users.schemas.js';

test('profile endpoints validate input and isolate users by verified identity', async (context) => {
  const records = new Map<string, Pick<User, "id" | "displayName" | "email" | "preferences" | "createdAt" | "updatedAt">>();
  const app = express();
  app.use(express.json());
  // Supply a verified user ID without going through the login flow.
  app.use((req, res, next) => {
    const userId = req.get('x-test-sub');
    if (userId) res.locals.userId = userId;
    next();
  });
  // Replace database calls for this test; the mocks are restored automatically.
  context.mock.method(usersRepository, "findById", async (id: string) => records.get(id) ?? null);
  context.mock.method(usersRepository, "save", async (id: string, data: UpdateProfileInput) => {
    const existing = records.get(id);
    if (!existing) return null;
    const user = {
      ...existing,
      displayName: data.displayName,
      ...(data.email !== undefined && { email: data.email }),
      ...(data.preferences !== undefined && { preferences: data.preferences }),
    };
    records.set(id, user);
    return user;
  });
  app.get('/me', getMe);
  app.put('/me', putMe);
  const client = request(app);

  await client.get('/me').expect(401);
  const headers = { 'x-test-sub': 'user-a' };
  await client.get('/me').set(headers).expect(404);
  await client.put('/me').set(headers).send({ displayName: 'Name' }).expect(404);
  records.set('user-a', { id: 'user-a', displayName: null, email: null, preferences: null, createdAt: new Date(), updatedAt: new Date() });
  for (const payload of [{ displayName: ' ' }, { displayName: 'a'.repeat(101) }, { displayName: 'Name', id: 'user-b' }]) {
    await client.put('/me').set(headers).send(payload).expect(400);
  }
  const result = await client.put('/me').set(headers).send({ displayName: ' Rohit ' }).expect(200);
  assert.equal(result.body.displayName, 'Rohit');
  await client.get('/me').set('x-test-sub', 'user-b').expect(404);
  await client.put('/me').set(headers).send({ displayName: null }).expect(200);
  assert.equal(records.size, 1);
  assert.equal(records.get('user-a')?.displayName, null);
});
