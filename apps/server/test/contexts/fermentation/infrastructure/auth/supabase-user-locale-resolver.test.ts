import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseUserLocaleResolver } from '@/contexts/fermentation/infrastructure/auth/supabase-user-locale-resolver.js';

function buildClient(metadata: Record<string, unknown> | undefined) {
  const getUserById = vi.fn().mockResolvedValue({
    data: { user: { id: 'u', user_metadata: metadata } },
    error: null,
  });
  // @type-assertion-allowed: テストで必要な最小限のメソッドだけスタブする
  const client = {
    auth: { admin: { getUserById } },
  } as unknown as SupabaseClient;
  return { client, getUserById };
}

describe('SupabaseUserLocaleResolver', () => {
  it('returns ja for locale=ja', async () => {
    const { client } = buildClient({ locale: 'ja' });
    const resolver = new SupabaseUserLocaleResolver(client);
    await expect(resolver.resolve('u')).resolves.toBe('ja');
  });

  it('returns en for locale=en', async () => {
    const { client } = buildClient({ locale: 'en' });
    const resolver = new SupabaseUserLocaleResolver(client);
    await expect(resolver.resolve('u')).resolves.toBe('en');
  });

  it('falls back to en for locale=zh (LLM only supports ja/en)', async () => {
    const { client } = buildClient({ locale: 'zh' });
    const resolver = new SupabaseUserLocaleResolver(client);
    await expect(resolver.resolve('u')).resolves.toBe('en');
  });

  it('falls back to en for locale=ko (LLM only supports ja/en)', async () => {
    const { client } = buildClient({ locale: 'ko' });
    const resolver = new SupabaseUserLocaleResolver(client);
    await expect(resolver.resolve('u')).resolves.toBe('en');
  });

  it('falls back to ja when locale metadata is missing', async () => {
    const { client } = buildClient({});
    const resolver = new SupabaseUserLocaleResolver(client);
    await expect(resolver.resolve('u')).resolves.toBe('ja');
  });

  it('falls back to ja when getUserById errors', async () => {
    const getUserById = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('x') });
    // @type-assertion-allowed: テストで必要な最小限のメソッドだけスタブする
    const client = {
      auth: { admin: { getUserById } },
    } as unknown as SupabaseClient;
    const resolver = new SupabaseUserLocaleResolver(client);
    await expect(resolver.resolve('u')).resolves.toBe('ja');
  });
});
