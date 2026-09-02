import { describe, expect, it } from 'vitest';
import { toStorageSafeName } from '@/contexts/board/infrastructure/storage/supabase-board-storage.gateway';

/**
 * 日本語のファイル名で写真の追加が 500 になっていた回帰を止める。
 * Supabase Storage のキーは限られた ASCII しか受け付けないので、繋ぐ前に均す。
 */
describe('toStorageSafeName', () => {
  it('ASCII の名前はそのまま残す', () => {
    expect(toStorageSafeName('busket-logo.png')).toBe('busket-logo.png');
  });

  it('日本語のファイル名でも ASCII だけのキーになる', () => {
    const safe = toStorageSafeName('ロゴ 画像.png');
    expect(safe).toMatch(/^[a-zA-Z0-9._-]+$/);
    expect(safe.endsWith('.png')).toBe(true);
  });

  it('名前が全部非 ASCII でも空にならない', () => {
    expect(toStorageSafeName('写真.jpeg')).toBe('photo.jpeg');
  });

  it('空白や括弧も安全な文字へ均す', () => {
    expect(toStorageSafeName('logo (1) copy.png')).toMatch(/^[a-zA-Z0-9._-]+\.png$/);
  });

  it('拡張子が無くても落ちない', () => {
    expect(toStorageSafeName('スクリーンショット')).toBe('photo');
  });

  it('極端に長い名前は切り詰める', () => {
    const safe = toStorageSafeName(`${'a'.repeat(300)}.png`);
    expect(safe.length).toBeLessThanOrEqual(64 + 4);
    expect(safe.endsWith('.png')).toBe(true);
  });

  it('区切り記号だけの名前でも空にならない', () => {
    expect(toStorageSafeName('---.png')).toBe('photo.png');
  });
});
