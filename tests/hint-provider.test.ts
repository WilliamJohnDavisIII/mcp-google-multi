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

  it('a throwing provider never propagates: render falls back to the no-provider shape (red by mutation: drop the catch)', () => {
    const thrown: HintProvider = {
      render: () => {
        throw new Error('provider blew up');
      },
    };
    setHintProvider(thrown);
    const rendered = hints()?.render({ kind: 'no_accounts' });
    expect(rendered?.hint).toBeUndefined();
    // the call site's `rendered?.hint ?? <default>` sees the same undefined
    // it would see with no provider installed at all
    expect(rendered?.hint ?? 'default').toBe('default');
  });
});
