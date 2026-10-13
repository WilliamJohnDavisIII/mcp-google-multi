import { describe, it, expect } from 'vitest';
import { toolHarness, parseResult } from './_tool-harness.js';

describe('calendar timeMin/timeMax require a timezone suffix', () => {
  it('calendar_list_events rejects a bare local datetime, naming the field', async () => {
    const h = toolHarness({ respond: () => ({ items: [] }) });
    const res = await h.call('calendar_list_events', {
      account: 'test',
      timeMin: '2026-04-04T00:00:00',
      timeMax: '2026-04-05T00:00:00Z',
    });
    const env = parseResult(res);
    expect(res.isError).toBe(true);
    expect(env.error).toBe('invalid_params');
    expect(env.message).toContain('timeMin');
    expect(env.hint).toContain('2026-04-04T00:00:00Z');
    expect(h.request).not.toHaveBeenCalled();
  });

  it('calendar_list_events accepts a numeric offset on both bounds', async () => {
    const h = toolHarness({ respond: () => ({ items: [] }) });
    const res = await h.call('calendar_list_events', {
      account: 'test',
      timeMin: '2026-04-04T00:00:00+01:00',
      timeMax: '2026-04-05T00:00:00+01:00',
    });
    expect(res.isError).toBeFalsy();
    expect(h.request).toHaveBeenCalled();
  });

  it('calendar_list_instances rejects a bare timeMax', async () => {
    const h = toolHarness({ respond: () => ({ items: [] }) });
    const res = await h.call('calendar_list_instances', {
      account: 'test',
      eventId: 'e1',
      timeMin: '2026-04-04T00:00:00Z',
      timeMax: '2026-04-05T00:00:00',
    });
    const env = parseResult(res);
    expect(res.isError).toBe(true);
    expect(env.error).toBe('invalid_params');
    expect(env.message).toContain('timeMax');
    expect(h.request).not.toHaveBeenCalled();
  });

  it('calendar_get_freebusy rejects a bare timeMin before the range check runs', async () => {
    const h = toolHarness({ respond: () => ({}) });
    const res = await h.call('calendar_get_freebusy', {
      account: 'test',
      calendarIds: ['primary'],
      timeMin: '2026-04-04T00:00:00',
      timeMax: '2026-04-05T00:00:00Z',
    });
    const env = parseResult(res);
    expect(res.isError).toBe(true);
    expect(env.error).toBe('invalid_params');
    expect(env.message).toContain('timeMin');
    expect(h.request).not.toHaveBeenCalled();
  });
});
