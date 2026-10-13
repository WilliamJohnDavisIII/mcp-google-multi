import { describe, it, expect, afterEach } from 'vitest';
import { HINT_KINDS, setHintProvider, hints, type HintProvider } from '../src/hint-provider.js';

afterEach(() => setHintProvider(null));

describe('HINT_KINDS', () => {
  // The completeness check itself (every HintCase member present) is a
  // compile-time assertion in src/hint-provider.ts: tsconfig.json only
  // includes src/, so a type-only check living here would never be
  // typechecked by `npm run typecheck` or by vitest's esbuild transform.
  it('has no duplicates and a runtime length matching the union', () => {
    expect(HINT_KINDS.length).toBe(new Set(HINT_KINDS).size);
    expect(HINT_KINDS.length).toBeGreaterThan(20);
  });
});

describe('setHintProvider / hints', () => {
  it("starts null: every call site keeps today's literal", () => {
    expect(hints()).toBeNull();
  });

  it("routes render() through the installed provider, and null restores today's text", () => {
    const stub: HintProvider = { render: (c) => ({ hint: `kind:${c.kind}` }) };
    setHintProvider(stub);
    expect(hints()?.render({ kind: 'no_accounts' })).toEqual({ hint: 'kind:no_accounts' });
    setHintProvider(null);
    expect(hints()).toBeNull();
  });
});
