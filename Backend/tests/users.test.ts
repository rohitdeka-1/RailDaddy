import type { User } from "../src/generated/prisma/index.js";
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { UsersController } from '../src/modules/users/controllers/users.controller.js';
import { UsersRepository } from '../src/modules/users/repositories/users.repository.js';
import type { UserRepository } from '../src/modules/users/repositories/users.repository.js';

test('profile endpoints validate input and isolate users by verified identity', async (context) => {
  const records = new Map<string, User>();
  const repository: UserRepository = {
    async findByCognitoSub(sub) { return records.get(sub) ?? null; },
    async save(sub, displayName) {
      const user = { id: sub, cognitoSub: sub, displayName, createdAt: new Date(), updatedAt: new Date() };
      records.set(sub, user);
      return user;
    },
  };
  const app = Fastify();
  app.decorateRequest('user', null);
  // Test-only principal injection; production uses the Cognito verifier.
  app.addHook('onRequest', async (request) => {
    const sub = request.headers['x-test-sub'];
    if (typeof sub === 'string') request.user = { cognitoSub: sub };
  });
  // Replace database calls for this test; the mocks are restored automatically.
  context.mock.method(UsersRepository.prototype, "findByCognitoSub", repository.findByCognitoSub);
  context.mock.method(UsersRepository.prototype, "save", repository.save);
  const controller = new UsersController();
  app.get('/me', async (request, reply) => controller.getMe(request, reply));
  app.put('/me', async (request, reply) => controller.putMe(request, reply));
  try {
    assert.equal((await app.inject('/me')).statusCode, 401);
    const headers = { 'x-test-sub': 'user-a' };
    assert.equal((await app.inject({ method: 'GET', url: '/me', headers })).statusCode, 404);
    for (const payload of [{ displayName: ' ' }, { displayName: 'a'.repeat(101) }, { displayName: 'Name', cognitoSub: 'user-b' }]) {
      assert.equal((await app.inject({ method: 'PUT', url: '/me', headers, payload })).statusCode, 400);
    }
    const result = await app.inject({ method: 'PUT', url: '/me', headers, payload: { displayName: ' Rohit ' } });
    assert.equal(result.statusCode, 200);
    assert.equal(result.json().displayName, 'Rohit');
    assert.equal((await app.inject({ method: 'GET', url: '/me', headers: { 'x-test-sub': 'user-b' } })).statusCode, 404);
    await app.inject({ method: 'PUT', url: '/me', headers, payload: { displayName: null } });
    assert.equal(records.size, 1);
    assert.equal(records.get('user-a')?.displayName, null);
  } finally { await app.close(); }
});
