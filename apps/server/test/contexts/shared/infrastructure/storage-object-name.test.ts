import { describe, expect, it } from 'vitest';
import { toSafeStorageFileName } from '@/contexts/shared/infrastructure/storage-object-name.js';

/**
 * Supabase Storage のキー検証は `\w` 系の限られた文字しか通さない。ここを外すと
 * `400 InvalidKey` になり、画面には「写真をアップロードできませんでした」としか出ない。
 *
 * 実際に踏んだのは macOS のスクリーンショット既定名（日本語 + 空白 + ドット複数）。
 */
describe('toSafeStorageFileName', () => {
  // これが本番で 400 を返したファイル名そのもの。
  it('日本語のスクリーンショット名を通せる形に落とす', () => {
    const result = toSafeStorageFileName('スクリーンショット 2026-08-09 10.11.11.jpg');

    // 基底名の中のドットも区切りに潰れる（拡張子の区切りだけが残る）。
    expect(result).toBe('2026-08-09-10-11-11.jpg');
    expect(result).toMatch(/^[A-Za-z0-9._-]+$/);
  });

  it('ASCII のファイル名はほぼそのまま残る', () => {
    expect(toSafeStorageFileName('IMG_1234.jpg')).toBe('IMG_1234.jpg');
    expect(toSafeStorageFileName('my-photo.png')).toBe('my-photo.png');
  });

  it('空白は潰し、連続した記号はまとめる', () => {
    expect(toSafeStorageFileName('a  b   c.jpg')).toBe('a-b-c.jpg');
  });

  it('前後の区切りが残らない', () => {
    expect(toSafeStorageFileName('  spaced  .jpg')).toBe('spaced.jpg');
  });

  // 名前が全部落ちても、キーが `<userId>/<ts>-` で終わって壊れないようにする。
  it('使える文字が1つも無ければ photo に落ちる', () => {
    expect(toSafeStorageFileName('日本語.jpg')).toBe('photo.jpg');
    expect(toSafeStorageFileName('写真')).toBe('photo');
  });

  it('拡張子が無くても壊れない', () => {
    expect(toSafeStorageFileName('photo')).toBe('photo');
  });

  // `.gitignore` のような先頭ドットを「拡張子だけの名前」と解釈しない。
  it('先頭のドットは拡張子の区切りにしない', () => {
    expect(toSafeStorageFileName('.hidden')).toBe('hidden');
  });

  it('極端に長い名前は切り詰める', () => {
    const result = toSafeStorageFileName(`${'a'.repeat(500)}.jpg`);

    expect(result).toBe(`${'a'.repeat(64)}.jpg`);
  });

  // 素通しすると `?` 以降がクエリ扱いされうる。キーに残さない。
  it('URL で意味を持つ文字を残さない', () => {
    expect(toSafeStorageFileName('a?b&c=d.jpg')).toBe('a-b-c-d.jpg');
  });

  it('パス区切りを埋め込ませない（ディレクトリを掘らせない）', () => {
    expect(toSafeStorageFileName('../../etc/passwd.jpg')).toBe('etc-passwd.jpg');
    expect(toSafeStorageFileName('../../etc/passwd.jpg')).not.toContain('/');
  });
});
