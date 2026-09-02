export const MAX_CONTENT_LENGTH = 100_000;
export const MAX_QUESTION_STRING_LENGTH = 64;

// Board
export const MAX_SNIPPET_TEXT_LENGTH = 2000;
export const MIN_CARD_SIZE = 120;
export const MAX_PHOTO_CAPTION_LENGTH = 20;
export const BOARD_CARD_TYPES = ['entry', 'snippet', 'photo'] as const;
export const BOARD_VIEW_TYPES = ['daily', 'weekly'] as const;

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
