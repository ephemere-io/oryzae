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
 * `[A-Za-z0-9._-]` 以外はすべて `-` に潰す。Storage が実際に許す文字はもう少し広いが、
 * `?` や `&` のような URL で意味を持つ文字や、`/` のようなパスを掘れる文字を残す利点が無い。
 *
 * board と entry の両方がここを通る。以前は同じ関数が board 側にも別実装で存在したが、
 * 片方だけ直す事故が起きるので 1 本に畳んである。
 */

/** キーが長くなりすぎないよう、基底名はこの文字数で切る。 */
const MAX_BASE_LENGTH = 60;
/** 拡張子の上限。長い拡張子はキーを膨らませるだけで意味を持たない。 */
const MAX_EXTENSION_LENGTH = 10;

function slugBase(value: string): string {
  return value
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '');
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

  const base = slugBase(rawBase).slice(0, MAX_BASE_LENGTH) || 'photo';
  // 拡張子は小文字に揃える（`.JPG` と `.jpg` で別キーにしない）。
  const extension = rawExtension
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, MAX_EXTENSION_LENGTH);

  return extension ? `${base}.${extension}` : base;
}
