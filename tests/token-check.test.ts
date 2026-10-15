import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkTokens, runTokenCheckCli, type TokenCheckDeps } from '../src/token-check.js';

function deps(over: Partial<TokenCheckDeps> = {}): TokenCheckDeps {
  return {
    aliases: () => ['work1', 'personal'],
    hasToken: () => true,
    request: async () => {},
    ...over,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('token-check', () => {
  it('passes every alias whose live call succeeds', async () => {
    expect(await checkTokens([], deps())).toEqual([
      { alias: 'work1', ok: true },
      { alias: 'personal', ok: true },
    ]);
  });

  it('reports a missing token without calling Google', async () => {
    const request = vi.fn(async () => {});
    const res = await checkTokens([], deps({ hasToken: (a) => a !== 'personal', request }));
    expect(res[1]).toMatchObject({ alias: 'personal', ok: false, error: 'auth_required' });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('maps a dead refresh token to reauth_required and never echoes the raw error', async () => {
    const secret = 'ya29.SECRET-ACCESS-TOKEN';
    const err = Object.assign(new Error('invalid_grant'), {
      response: { status: 400, data: { error: 'invalid_grant', error_description: 'Token has been expired or revoked.' } },
      config: { headers: { Authorization: `Bearer ${secret}` } },
    });
    const res = await checkTokens([], deps({ request: async (a) => { if (a === 'work1') throw err; } }));
    expect(res[0]).toMatchObject({ alias: 'work1', ok: false, error: 'reauth_required' });
    expect(JSON.stringify(res)).not.toContain(secret);
  });

  it('limits the run to --account and exits non-zero on any failure', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const request = vi.fn(async () => { throw Object.assign(new Error('boom'), { response: { status: 500 } }); });
    const code = await runTokenCheckCli(['node', 'x', 'token-check', '--account', 'personal', '--json'], deps({ request }));
    expect(code).toBe(1);
    expect(request).toHaveBeenCalledWith('personal', expect.any(String));
    expect(JSON.parse(log.mock.calls[0][0] as string)).toHaveLength(1);
  });

  it('exits non-zero when no aliases are configured', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await runTokenCheckCli(['token-check'], deps({ aliases: () => [] }))).toBe(1);
  });
});
