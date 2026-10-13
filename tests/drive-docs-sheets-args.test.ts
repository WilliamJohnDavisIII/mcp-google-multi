import { describe, it, expect } from 'vitest';
import { toolHarness } from './_tool-harness.js';

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
