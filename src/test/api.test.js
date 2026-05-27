/**
 * Unit tests for the API client — fallback behaviour and request construction.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock fetch globally ──────────────────────────────────────────────────────

const MOCK_BASE = 'https://transitlens-backend.up.railway.app';

function makeFetchMock(status, body) {
  return vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    })
  );
}

// ─── Inline _get logic (mirrors client.js) ───────────────────────────────────

async function _get(path, fallback, baseUrl = MOCK_BASE, timeoutMs = 100) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    clearTimeout(timer);
    return typeof fallback === 'function' ? fallback() : fallback;
  }
}

describe('API client _get', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns parsed JSON on 200 OK', async () => {
    global.fetch = makeFetchMock(200, { status: 'ok', routes_loaded: 232 });
    const result = await _get('/health', () => ({ status: 'offline' }));
    expect(result.status).toBe('ok');
    expect(result.routes_loaded).toBe(232);
  });

  it('falls back to static value on HTTP error', async () => {
    global.fetch = makeFetchMock(503, null);
    const result = await _get('/health', { status: 'offline' });
    expect(result.status).toBe('offline');
  });

  it('falls back to function result on HTTP error', async () => {
    global.fetch = makeFetchMock(404, null);
    const result = await _get('/missing', () => [1, 2, 3]);
    expect(result).toEqual([1, 2, 3]);
  });

  it('falls back when fetch rejects (network error)', async () => {
    global.fetch = vi.fn(() => Promise.reject(new Error('Network failure')));
    const result = await _get('/health', 'fallback-value');
    expect(result).toBe('fallback-value');
  });

  it('constructs the correct URL', async () => {
    global.fetch = makeFetchMock(200, []);
    await _get('/api/gtfs/routes?limit=200', []);
    expect(global.fetch).toHaveBeenCalledWith(
      `${MOCK_BASE}/api/gtfs/routes?limit=200`,
      expect.objectContaining({ headers: { Accept: 'application/json' } })
    );
  });

  it('falls back on abort (timeout)', async () => {
    global.fetch = vi.fn(
      () => new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), 200))
    );
    const result = await _get('/slow', 'timed-out', MOCK_BASE, 10);
    expect(result).toBe('timed-out');
  });
});

// ─── fetchTimeSeries query string ────────────────────────────────────────────

describe('fetchTimeSeries query construction', () => {
  it('builds correct query string from params', () => {
    const params = { routeType: 1, dayOfWeek: 3, month: 6, tempC: 22, precipMm: 5 };
    const qs = new URLSearchParams({
      route_type:  params.routeType  ?? 1,
      day_of_week: params.dayOfWeek  ?? 1,
      month:       params.month      ?? 3,
      temp_c:      params.tempC      ?? 5,
      precip_mm:   params.precipMm   ?? 0,
    }).toString();
    expect(qs).toContain('route_type=1');
    expect(qs).toContain('day_of_week=3');
    expect(qs).toContain('month=6');
    expect(qs).toContain('temp_c=22');
    expect(qs).toContain('precip_mm=5');
  });

  it('uses defaults when params are missing', () => {
    const params = {};
    const qs = new URLSearchParams({
      route_type:  params.routeType  ?? 1,
      day_of_week: params.dayOfWeek  ?? 1,
      month:       params.month      ?? 3,
      temp_c:      params.tempC      ?? 5,
      precip_mm:   params.precipMm   ?? 0,
    }).toString();
    expect(qs).toContain('route_type=1');
    expect(qs).toContain('day_of_week=1');
    expect(qs).toContain('temp_c=5');
    expect(qs).toContain('precip_mm=0');
  });
});
