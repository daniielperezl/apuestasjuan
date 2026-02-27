const request = require('supertest');

// Mock environment before loading server
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'sportbets_user';
process.env.DB_NAME = 'sportbets_test';
process.env.REDIS_HOST = 'localhost';
process.env.ENCRYPTION_KEY = 'a'.repeat(64);

// Mock database and redis for unit tests
jest.mock('../../backend/config/database', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { on: jest.fn() }
}));

jest.mock('../../backend/config/redis', () => ({
  getRedisClient: jest.fn(),
  setCache: jest.fn(),
  getCache: jest.fn().mockResolvedValue(null),
  deleteCache: jest.fn(),
  setSession: jest.fn(),
  getSession: jest.fn(),
  deleteSession: jest.fn()
}));

jest.mock('../../backend/services/matchSyncService', () => ({
  startCronJobs: jest.fn()
}));

jest.mock('../../backend/services/notificationService', () => ({
  setSocketIO: jest.fn()
}));

const { app } = require('../../backend/server');

describe('Health Check', () => {
  it('GET /api/v1/health should return OK', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.bogotaTime).toBeDefined();
  });
});

describe('Auth API', () => {
  it('POST /api/v1/auth/register should validate email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'invalid-email', password: 'short', nombre: 'Test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('POST /api/v1/auth/register should require strong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@test.com', password: 'weakpassword', nombre: 'Test' });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/auth/login should require credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });

  it('Protected routes should return 401 without token', async () => {
    const res = await request(app).get('/api/v1/auth/profile');
    expect(res.status).toBe(401);
  });

  it('Should reject invalid JWT', async () => {
    const res = await request(app)
      .get('/api/v1/auth/profile')
      .set('Authorization', 'Bearer invalid.token.here');
    expect(res.status).toBe(401);
  });
});

describe('Matches API', () => {
  beforeEach(() => {
    const { query } = require('../../backend/config/database');
    query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it('GET /api/v1/encuentros/hoy should be accessible', async () => {
    const { query } = require('../../backend/config/database');
    query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/v1/encuentros/hoy');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('matches');
  });
});

describe('Rate Limiting', () => {
  it('Should rate limit login attempts', async () => {
    const { query } = require('../../backend/config/database');
    query.mockResolvedValue({ rows: [] });

    const requests = Array.from({ length: 7 }, () =>
      request(app).post('/api/v1/auth/login').send({ email: 'test@test.com', password: 'Test123!' })
    );

    const responses = await Promise.all(requests);
    const rateLimited = responses.some(r => r.status === 429);
    // After 5 requests, should get rate limited
    expect(rateLimited).toBe(true);
  });
});
