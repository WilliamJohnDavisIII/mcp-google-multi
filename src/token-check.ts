import { getAccountSet } from './accounts.js';
import type { Account } from './accounts.js';
import { getClient } from './client.js';
import { hasToken } from './token-store.js';
import { mapGoogleError } from './tools/_errors.js';

// Fork (gmcp): doctor probes only the first healthy alias and passes while a
// token file exists, so a revoked token goes unnoticed. This makes one live
// Gmail call per alias, which refreshes an expired access token on the way.

const GMAIL_PROFILE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/profile';

export interface TokenCheckResult {
  alias: string;
  ok: boolean;
  error?: string;
  message?: string;
}

export interface TokenCheckDeps {
  aliases: () => readonly string[];
  hasToken: (alias: string) => boolean;
  request: (alias: string, url: string) => Promise<void>;
}

const DEFAULT_DEPS: TokenCheckDeps = {
  aliases: () => getAccountSet().aliases,
  hasToken,
  request: async (alias, url) => {
    const auth = await getClient(alias as Account);
    await auth.request({ url, timeout: 15_000 });
  },
};

export async function checkTokens(only: readonly string[] = [], deps: TokenCheckDeps = DEFAULT_DEPS): Promise<TokenCheckResult[]> {
  const aliases = only.length > 0 ? only : deps.aliases();
  const results: TokenCheckResult[] = [];
  for (const alias of aliases) {
    if (!deps.hasToken(alias)) {
      results.push({ alias, ok: false, error: 'auth_required', message: 'no token stored; link the account first' });
      continue;
    }
    try {
      await deps.request(alias, GMAIL_PROFILE_URL);
      results.push({ alias, ok: true });
    } catch (error: any) {
      // Envelope fields only: never the raw error, which can carry token material.
      const envelope = mapGoogleError(error, alias as Account);
      results.push({ alias, ok: false, error: envelope.error, message: envelope.message });
    }
  }
  return results;
}

/** `token-check [--account a,b] [--json]`: exit 0 only when every alias passed. */
export async function runTokenCheckCli(argv: string[], deps?: TokenCheckDeps): Promise<number> {
  const at = argv.indexOf('--account');
  const only = at >= 0 && argv[at + 1] ? argv[at + 1].split(',').map((s) => s.trim()).filter(Boolean) : [];
  const results = await checkTokens(only, deps);
  if (argv.includes('--json')) {
    console.log(JSON.stringify(results));
  } else {
    for (const r of results) console.log(r.ok ? `ok    ${r.alias}` : `FAIL  ${r.alias}: ${r.error} (${r.message})`);
  }
  return results.length > 0 && results.every((r) => r.ok) ? 0 : 1;
}
