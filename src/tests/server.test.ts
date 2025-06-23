// import request from 'supertest';
// src/tests/server.test.ts
const request = require('supertest');
const app = require('../server').default;
// import app from '../server';  // import your Express app

describe('Basic API tests', () => {
  it('GET /api/ping returns pong', async () => {
    const res = await request(app).get('/api/ping');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('pong');
  });

  it('POST /api/validate-industry for known company', async () => {
    const res = await request(app).post('/api/validate-industry').send({ company: 'Nestle' });
    expect(res.status).toBe(200);
    expect(res.body.industryMatch).toBe(true);
    expect(res.body.companyOverview).toContain('Nestle');
  });

  it('POST /api/validate-industry for unknown company', async () => {
    const res = await request(app).post('/api/validate-industry').send({ company: 'UnknownCo' });
    expect(res.status).toBe(200);
    expect(res.body.industryMatch).toBe(false);
  });
});
