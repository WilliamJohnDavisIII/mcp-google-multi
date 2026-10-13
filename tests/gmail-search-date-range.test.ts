import { describe, it, expect } from 'vitest';
import { toolHarness, parseResult } from './_tool-harness.js';

describe('gmail_search since/until', () => {
  it('appends after:<epoch seconds> to the query for since', async () => {
    const h = toolHarness({ respond: () => ({ messages: [] }) });
    await h.call('gmail_search', { account: 'test', query: 'is:unread', since: '2024-01-01T00:00:00Z' });
    const req = h.requests().find((r) => r.url.includes('/messages'));
    expect(req?.params).toMatchObject({ q: 'is:unread after:1704067200' });
  });

  it('appends before:<epoch seconds> to the query for until', async () => {
    const h = toolHarness({ respond: () => ({ messages: [] }) });
    await h.call('gmail_search', { account: 'test', query: 'is:unread', until: '2024-01-01T00:00:00Z' });
    const req = h.requests().find((r) => r.url.includes('/messages'));
    expect(req?.params).toMatchObject({ q: 'is:unread before:1704067200' });
  });

  it('accepts a plain ISO date (no time component)', async () => {
    const h = toolHarness({ respond: () => ({ messages: [] }) });
    await h.call('gmail_search', { account: 'test', query: 'is:unread', since: '2024-01-01' });
    const req = h.requests().find((r) => r.url.includes('/messages'));
    expect(req?.params).toMatchObject({ q: 'is:unread after:1704067200' });
  });

  it('combines since and until in one query', async () => {
    const h = toolHarness({ respond: () => ({ messages: [] }) });
    await h.call('gmail_search', {
      account: 'test',
      query: 'is:unread',
      since: '2024-01-01T00:00:00Z',
      until: '2024-02-01T00:00:00Z',
    });
    const req = h.requests().find((r) => r.url.includes('/messages'));
    expect(req?.params).toMatchObject({ q: 'is:unread after:1704067200 before:1706745600' });
  });

  it('rejects an unparsable since with invalidParams naming the field', async () => {
    const h = toolHarness();
    const res = await h.call('gmail_search', { account: 'test', query: 'is:unread', since: 'not-a-date' });
    expect(res.isError).toBe(true);
    const env = parseResult(res);
    expect(env.error).toBe('invalid_params');
    expect(env.message).toContain('since');
    expect(h.request).not.toHaveBeenCalled();
  });

  it('rejects an unparsable until with invalidParams naming the field', async () => {
    const h = toolHarness();
    const res = await h.call('gmail_search', { account: 'test', query: 'is:unread', until: 'not-a-date' });
    expect(res.isError).toBe(true);
    const env = parseResult(res);
    expect(env.error).toBe('invalid_params');
    expect(env.message).toContain('until');
    expect(h.request).not.toHaveBeenCalled();
  });
});
