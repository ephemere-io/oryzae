/**
 * クライアント / サーバー両方から使う、依存ゼロの型と純粋関数。
 * fs を引き込まないために、`load-content.ts` から分離している。
 */

export type SupportContent = Record<string, string>;

/**
 * MD（YAML frontmatter + `# dot.path` 本文セクション）をフラットなキーマップに展開する。
 */
export function parseSupportMarkdown(text: string): SupportContent {
  const result: SupportContent = {};

  // --- frontmatter (--- で囲まれた領域) を抽出
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error('support content: frontmatter (--- ... ---) が見つかりません');
  }
  const frontmatter = fmMatch[1];
  const body = fmMatch[2] ?? '';

  // frontmatter は `dot.path: value` 形式の1行ペアのみ
  for (const line of frontmatter.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();
    if (key.length === 0) continue;
    result[key] = value;
  }

  // body は `# dot.path\n\n本文...\n\n# next.key\n...` の繰り返し
  const sections = body.split(/^# (.+)$/m);
  for (let i = 1; i < sections.length; i += 2) {
    const key = sections[i].trim();
    const value = (sections[i + 1] ?? '').trim();
    if (key.length === 0) continue;
    result[key] = value;
  }

  return result;
}

/**
 * `useTranslations` 互換の参照ヘルパー。
 * キーが存在しない場合は明示的にエラーを投げる（本番で気づけるように）。
 */
export function makeT(content: SupportContent): (key: string) => string {
  return (key: string): string => {
    const value = content[key];
    if (value === undefined) {
      throw new Error(`support content: 未定義のキー "${key}"`);
    }
    return value;
  };
}
