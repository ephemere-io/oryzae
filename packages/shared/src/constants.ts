export const MAX_CONTENT_LENGTH = 100_000;
export const MAX_QUESTION_STRING_LENGTH = 64;

// Board
export const MAX_SNIPPET_TEXT_LENGTH = 50;
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
/** 文字起こしに渡す前に長辺をこの px まで縮める（画像トークン量を抑えるため）。 */
export const ENTRY_PHOTO_MAX_EDGE_PX = 1568;
