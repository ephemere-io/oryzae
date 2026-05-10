/**
 * サポートページ用 MD コンテンツのサーバーサイドローダー。
 *
 * 形式（content/support/{ja,en}.md）:
 *   ---
 *   # YAML 風 frontmatter（短い1行値のみ。dot.path: value）
 *   hero.title: 使い方とよくある質問
 *   nav.cta: アプリを試す
 *   ---
 *
 *   # dot.path
 *   ここから次の `# ...` までが本文（複数段落可、改行は空行で）。
 *
 *   # faq.1.q
 *   書いた文章はどこに保存されますか？
 *
 * 結果はフラットな `Record<string, string>` を返す。
 * `t(key)` ヘルパーで、`useTranslations` と同じ感覚で参照できる。
 *
 * このファイルは fs を import するため、サーバーコンポーネントからのみ使う。
 * クライアントから使う型と純粋関数は `content-types.ts` 側に分離している。
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Locale } from '@/i18n/config';
import { parseSupportMarkdown, type SupportContent } from './content-types';

/**
 * locale に応じた MD ファイルを読み込み、フラットなキーマップに展開して返す。
 * Next.js のサーバーコンポーネントから呼ぶ前提。
 */
export function loadSupportContent(locale: Locale): SupportContent {
  const filePath = join(process.cwd(), 'content', 'support', `${locale}.md`);
  const raw = readFileSync(filePath, 'utf8');
  return parseSupportMarkdown(raw);
}
