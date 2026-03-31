process.env.DB_PATH = ':memory:';
require('dotenv').config();

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server');

const BASE = {
  campaign: 'test-campaign',
  source: 'linkedin',
  medium: 'social',
  destination_url: 'https://versino.de/test/',
  utm_url: 'https://versino.de/test/?utm_source=linkedin&utm_medium=social&utm_campaign=test-campaign',
  created_by: 'hagen',
};

describe('Links API', () => {
  test('POST /api/links — creates a link, returns 201', async () => {
    const res = await request(app).post('/api/links').send(BASE);
    assert.equal(res.status, 201);
    assert.equal(res.body.campaign, 'test-campaign');
    assert.ok(res.body.id);
    assert.equal(res.body.status, 'active');
  });

  test('POST /api/links — 400 when required fields missing', async () => {
    const res = await request(app).post('/api/links').send({ campaign: 'only' });
    assert.equal(res.status, 400);
    assert.ok(res.body.error);
  });

  test('GET /api/links — returns array including created link', async () => {
    await request(app).post('/api/links').send(BASE);
    const res = await request(app).get('/api/links');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length >= 1);
  });

  test('GET /api/links?q= — filters by search term', async () => {
    await request(app).post('/api/links').send({ ...BASE, campaign: 'unique-xyz-find-me' });
    const res = await request(app).get('/api/links?q=unique-xyz');
    assert.equal(res.status, 200);
    assert.ok(res.body.every(l => JSON.stringify(l).includes('unique-xyz')));
  });

  test('GET /api/links?status=archived — returns only archived', async () => {
    const post = await request(app).post('/api/links').send({ ...BASE, source: 'facebook' });
    await request(app).patch(`/api/links/${post.body.id}`).send({ status: 'archived' });
    const res = await request(app).get('/api/links?status=archived');
    assert.equal(res.status, 200);
    assert.ok(res.body.length >= 1);
    assert.ok(res.body.every(l => l.status === 'archived'));
  });

  test('PATCH /api/links/:id — updates status', async () => {
    const post = await request(app).post('/api/links').send({ ...BASE, source: 'email' });
    const res = await request(app).patch(`/api/links/${post.body.id}`).send({ status: 'archived' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'archived');
  });

  test('PATCH /api/links/:id — 404 for unknown id', async () => {
    const res = await request(app).patch('/api/links/99999').send({ status: 'archived' });
    assert.equal(res.status, 404);
  });

  test('DELETE /api/links/:id — deletes link', async () => {
    const post = await request(app).post('/api/links').send({ ...BASE, source: 'instagram' });
    const id = post.body.id;
    assert.equal((await request(app).delete(`/api/links/${id}`)).status, 204);
    const list = await request(app).get('/api/links');
    assert.ok(!list.body.some(l => l.id === id));
  });

  test('DELETE /api/links/:id — 404 for unknown id', async () => {
    const res = await request(app).delete('/api/links/99999');
    assert.equal(res.status, 404);
  });

  test('GET /api/links/sources — returns distinct source values', async () => {
    await request(app).post('/api/links').send({ ...BASE, source: 'src-alpha' });
    await request(app).post('/api/links').send({ ...BASE, source: 'src-beta' });
    const res = await request(app).get('/api/links/sources');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.includes('src-alpha'));
    assert.ok(res.body.includes('src-beta'));
  });
});
