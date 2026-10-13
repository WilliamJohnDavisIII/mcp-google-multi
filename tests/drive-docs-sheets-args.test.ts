import { describe, it, expect } from 'vitest';
import { toolHarness, parseResult as parse } from './_tool-harness.js';

describe('drive_search orderBy', () => {
  it('forwards orderBy to files.list when passed', async () => {
    const h = toolHarness({ respond: () => ({ files: [] }) });
    await h.call('drive_search', { account: 'test', query: 'report', orderBy: 'modifiedTime desc' });
    const req = h.requests().find((r) => r.url.includes('/drive/v3/files'));
    expect((req?.params as Record<string, unknown>)?.orderBy).toBe('modifiedTime desc');
  });

  it('omits orderBy when not passed', async () => {
    const h = toolHarness({ respond: () => ({ files: [] }) });
    await h.call('drive_search', { account: 'test', query: 'report' });
    const req = h.requests().find((r) => r.url.includes('/drive/v3/files'));
    expect(req?.params).not.toHaveProperty('orderBy');
  });
});

describe('drive_share local validation', () => {
  it('rejects type=user with no emailAddress, before any request', async () => {
    const h = toolHarness();
    const res = await h.call('drive_share', { account: 'test', fileId: 'F1', type: 'user', role: 'reader' });
    const env = parse(res);
    expect(res.isError).toBe(true);
    expect(env.error).toBe('invalid_params');
    expect(env.message).toContain('emailAddress');
    expect(h.requests()).toHaveLength(0);
  });

  it('rejects type=group with no emailAddress', async () => {
    const h = toolHarness();
    const res = await h.call('drive_share', { account: 'test', fileId: 'F1', type: 'group', role: 'reader' });
    expect(parse(res).error).toBe('invalid_params');
    expect(h.requests()).toHaveLength(0);
  });

  it('rejects type=domain with no domain', async () => {
    const h = toolHarness();
    const res = await h.call('drive_share', { account: 'test', fileId: 'F1', type: 'domain', role: 'reader' });
    const env = parse(res);
    expect(env.error).toBe('invalid_params');
    expect(env.message).toContain('domain');
    expect(h.requests()).toHaveLength(0);
  });

  it('allows type=anyone with neither emailAddress nor domain', async () => {
    const h = toolHarness({ respond: () => ({ id: 'P1', type: 'anyone', role: 'reader' }) });
    const res = await h.call('drive_share', { account: 'test', fileId: 'F1', type: 'anyone', role: 'reader' });
    expect(res.isError).toBeFalsy();
    expect(h.requests()).toHaveLength(1);
  });
});
