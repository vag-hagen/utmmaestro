process.env.DB_PATH = ':memory:';
process.env.GA4_PROPERTY_ID = '391019102';
require('dotenv').config();

// Mock refreshGa4Cache before requiring server
const ga4Service = require('../services/ga4');
let mockCalled = false;
ga4Service.refreshGa4Cache = async (_range) => { mockCalled = true; return 5; };

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../server');
const db = require('../db');

describe('GA4 routes', () => {
  test('GET /api/ga4?range=30d — returns empty rows and summary when no cache', async () => {
    const res = await request(app).get('/api/ga4?range=30d');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.rows));
    assert.ok(Array.isArray(res.body.summary));
    assert.equal(res.body.range, '30d');
  });

  test('GET /api/ga4?range=30d — returns cached rows and aggregated summary', async () => {
    db.prepare(
      'INSERT INTO ga4_cache (campaign, source, medium, report_date, date_range, sessions, users, conversions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('camp-a', 'linkedin', 'social', '2026-03-01', '30d', 100, 80, 5);
    db.prepare(
      'INSERT INTO ga4_cache (campaign, source, medium, report_date, date_range, sessions, users, conversions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('camp-a', 'linkedin', 'social', '2026-03-02', '30d', 50, 40, 2);

    const res = await request(app).get('/api/ga4?range=30d');
    assert.equal(res.status, 200);
    assert.ok(res.body.rows.length >= 2);
    const s = res.body.summary.find(r => r.campaign === 'camp-a');
    assert.ok(s);
    assert.equal(s.sessions, 150);
    assert.equal(s.conversions, 7);
  });

  test('POST /api/ga4/refresh — calls refreshGa4Cache and returns data', async () => {
    mockCalled = false;
    const res = await request(app).post('/api/ga4/refresh').send({ range: '30d' });
    assert.equal(res.status, 200);
    assert.ok(mockCalled);
    assert.equal(res.body.range, '30d');
    assert.ok(res.body.rows !== undefined);
  });

  test('POST /api/ga4/refresh — defaults to 30d when no range provided', async () => {
    const res = await request(app).post('/api/ga4/refresh').send({});
    assert.equal(res.status, 200);
    assert.equal(res.body.range, '30d');
  });
});
