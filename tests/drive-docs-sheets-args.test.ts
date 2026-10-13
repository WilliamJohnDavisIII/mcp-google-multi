import { describe, it, expect } from 'vitest';
import { toolHarness, fakeServer, parseResult as parse } from './_tool-harness.js';
import { buildRegistry } from '../src/compose.js';
import { buildIdentityContext } from '../src/identity.js';

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

describe('drive_upload contentBase64', () => {
  it('is registered for a non-owner context (the harness default), without localPath', async () => {
    const h = toolHarness();
    expect(h.handlers.drive_upload).toBeDefined();
    expect(h.schemas.drive_upload).not.toHaveProperty('localPath');
    expect(h.schemas.drive_upload).toHaveProperty('contentBase64');
  });

  it('is registered for the owner context too, with localPath available', async () => {
    const ctx = buildIdentityContext({} as NodeJS.ProcessEnv);
    const { server, handlers, schemas } = fakeServer();
    buildRegistry(server as never, ctx, 'eager');
    expect(handlers.drive_upload).toBeDefined();
    expect(schemas.drive_upload).toHaveProperty('localPath');
    expect(schemas.drive_upload).toHaveProperty('contentBase64');
  });

  it('uploads inline base64 content', async () => {
    const h = toolHarness({ respond: () => ({ id: 'F9', name: 'f.txt', mimeType: 'text/plain', webViewLink: 'https://x' }) });
    const res = await h.call('drive_upload', {
      account: 'test',
      filename: 'f.txt',
      contentBase64: Buffer.from('hello world').toString('base64'),
    });
    expect(res.isError).toBeFalsy();
    expect(parse(res)).toEqual({ id: 'F9', name: 'f.txt', mimeType: 'text/plain', webViewLink: 'https://x' });
    const upload = h.requests().find((r) => r.url.includes('/upload/drive/v3/files'));
    expect(upload).toBeDefined();
  });

  it('rejects content over the 10MB decoded cap, before any request', async () => {
    const h = toolHarness();
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 'a').toString('base64');
    const res = await h.call('drive_upload', { account: 'test', filename: 'big.bin', contentBase64: big });
    const env = parse(res);
    expect(res.isError).toBe(true);
    expect(env.error).toBe('invalid_params');
    expect(h.requests()).toHaveLength(0);
  });

  it('rejects when neither contentBase64 nor localPath is passed', async () => {
    const h = toolHarness();
    const res = await h.call('drive_upload', { account: 'test', filename: 'f.txt' });
    expect(parse(res).error).toBe('invalid_params');
    expect(h.requests()).toHaveLength(0);
  });

  it('rejects when localPath is passed on a non-owner context (undeclared, so it reaches the handler as an unknown key)', async () => {
    const h = toolHarness();
    const res = await h.handlers.drive_upload({ account: 'test', filename: 'f.txt', localPath: '/etc/hostname' });
    expect(res.isError).toBe(true);
    expect(h.requests()).toHaveLength(0);
  });
});
