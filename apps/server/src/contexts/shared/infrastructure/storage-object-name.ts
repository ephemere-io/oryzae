/**
 * アップロードされたファイル名を、Supabase Storage のオブジェクトキーに使える形へ落とす。
 *
 * **なぜ必要か**: Storage のキー検証は `\w`（= `[A-Za-z0-9_]`）を基本とした限られた文字しか
 * 通さない。日本語のファイル名（例: `スクリーンショット 2026-08-09 10.11.11.jpg`）を
 * そのままキーに入れると、Storage が `400 InvalidKey` を返し、アップロードが必ず失敗する。
 * 画面には「写真をアップロードできませんでした」としか出ないため、原因が非常に見えにくい。
 *
 * ファイル名はキーの見た目を分かりやすくするためだけのもので、意味を持たない
 * （パスの先頭は userId、続けてタイムスタンプが入る）。安全側に倒して
 * `[A-Za-z0-9_-]` 以外はすべて `-` に潰し、拡張子の区切りのドットだけを残す。
 * Storage が実際に許す文字はもう少し広いが、`?` や `&` のような URL で意味を持つ文字や、
 * `/` のようなパスを掘れる文字を残す利点が無い。
 */

/** キーが長くなりすぎないよう、基底名はこの文字数で切る。 */
const MAX_BASE_LENGTH = 64;

function slug(value: string): string {
  return value
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * @param fileName 元のファイル名（ユーザー由来。信用しない）
 * @returns Storage のキーに埋め込める名前。全滅した場合は `photo` に落ちる。
 */
export function toSafeStorageFileName(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  // 先頭のドット（`.gitignore` のような隠しファイル名）は拡張子の区切りとみなさない。
  const hasExtension = lastDot > 0;
  const rawBase = hasExtension ? fileName.slice(0, lastDot) : fileName;
  const rawExtension = hasExtension ? fileName.slice(lastDot + 1) : '';

  const base = slug(rawBase).slice(0, MAX_BASE_LENGTH) || 'photo';
  const extension = slug(rawExtension);

  return extension ? `${base}.${extension}` : base;
}
