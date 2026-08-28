import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

describe('manifest', () => {
  it('PWA インストールに必要な基本フィールドを持つ', () => {
    const m = manifest();
    expect(m.display).toBe('standalone');
    // Issue #437: ホーム画面から開いたときにランディングを出さない。start_url はアプリの入口。
    expect(m.start_url).toBe('/entries/new');
    // scope はルートのまま（/login や /jar へも遷移できる必要がある）。
    expect(m.scope).toBe('/');
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.theme_color).toBeTruthy();
    expect(m.background_color).toBeTruthy();
  });

  it('192 / 512 / maskable アイコンを含む', () => {
    const icons = manifest().icons ?? [];
    const sizes = icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect(icons.some((i) => i.purpose === 'maskable')).toBe(true);
  });
});
