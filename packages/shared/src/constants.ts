export const MAX_CONTENT_LENGTH = 100_000;
export const MAX_QUESTION_STRING_LENGTH = 64;

// Board
export const MAX_SNIPPET_TEXT_LENGTH = 2000;
export const MIN_CARD_SIZE = 120;
export const MAX_PHOTO_CAPTION_LENGTH = 20;
export const BOARD_CARD_TYPES = ['entry', 'snippet', 'photo'] as const;
export const BOARD_VIEW_TYPES = ['daily', 'weekly'] as const;

// エントリに添える写真。Anthropic の vision が受理するのは jpeg/png/gif/webp のみなので、
// 文字起こしに回せない形式を最初から弾く（クライアントの canvas リサイズが HEIC 等を
// JPEG に正規化するため、実際にここへ来るのは基本 jpeg）。詳細は docs/entry-photo-guide.md。
export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;
export const MAX_ENTRY_PHOTO_BYTES = 10 * 1024 * 1024;
/**
 * 本文中に置いた写真 1 枚を表す 1 文字（U+FFFC OBJECT REPLACEMENT CHARACTER）。
 *
 * 本文に「写真がここにある」印を埋めることで、位置がテキスト編集にそのまま追従する
 * （前に文字を足せばずれ、消せば写真も消える）。専用の不可視文字を使うのは、
 * `[写真1]` のような可読トークンだと利用者が普通に打ててしまい、本物と区別できなくなるため。
 *
 * この 1 文字は `content` に含まれるので、発酵プロンプト・検索・文字数にも乗る。
 * 1 枚 1 文字なので実害は無いと判断している。
 */
export const INLINE_IMAGE_PLACEHOLDER = '\uFFFC';
/** 文字起こしに渡す前に長辺をこの px まで縮める（画像トークン量を抑えるため）。 */
export const ENTRY_PHOTO_MAX_EDGE_PX = 1568;

// Board — OCR（画像を読み取ってスニペット本文にする）
export const OCR_ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;
export const MAX_OCR_IMAGE_BYTES = 5 * 1024 * 1024;
/**
 * OCR が返す本文の上限。スニペット本体の上限 (MAX_SNIPPET_TEXT_LENGTH) と同じ値にして
 * ある。以前は 50 文字しか入らず、読み取れた文章をユーザーが手で削る必要があった
 * （勝手に切り詰めると、どこが落ちたのか分からないまま貼られてしまう）。
 */
export const MAX_OCR_TEXT_LENGTH = 2_000;
