import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useDevice } from '@/lib/use-device';

function setCookie(value: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: テストで cookie を直接書き込み useDevice を駆動する
  document.cookie = value;
}

function clearCookies() {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim();
    if (name) setCookie(`${name}=; max-age=0; path=/`);
  }
}

describe('useDevice', () => {
  beforeEach(clearCookies);
  afterEach(clearCookies);

  it('device-pref（手動切替）を最優先する', async () => {
    setCookie('device=pc; path=/');
    setCookie('device-pref=sp; path=/');
    const { result } = renderHook(() => useDevice());
    await waitFor(() => expect(result.current).toBe('sp'));
  });

  it('pref が無ければ device cookie を読む', async () => {
    setCookie('device=sp; path=/');
    const { result } = renderHook(() => useDevice());
    await waitFor(() => expect(result.current).toBe('sp'));
  });

  it('どちらの cookie も無ければ pc にフォールバックする', async () => {
    const { result } = renderHook(() => useDevice());
    await waitFor(() => expect(result.current).toBe('pc'));
  });

  it('不正な値の cookie は無視して pc にする', async () => {
    setCookie('device=tablet; path=/');
    const { result } = renderHook(() => useDevice());
    await waitFor(() => expect(result.current).toBe('pc'));
  });
});
