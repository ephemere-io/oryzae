/**
 * 発酵ドメインの共有型（端末非依存）。
 *
 * Issue #490: もともと同じ発酵詳細の型が pc/fermentation・pc/entries・shared/fermentation に
 * 3つ生えていた（reach 分離により pc 間で共有できず、SP も別形で持った）。ここに1本化する。
 */

/** 瓶ビュー上の座標（0-100 の %）。null なら既定配置にフォールバックする。 */
export interface JarPositioned {
  jarX: number | null;
  jarY: number | null;
}

export interface FermentationSnippet extends JarPositioned {
  id: string;
  snippetType: 'new_perspective' | 'deepen' | 'core';
  originalText: string;
  sourceDate: string;
  selectionReason: string;
}

export interface FermentationKeyword extends JarPositioned {
  id: string;
  keyword: string;
  description: string;
}

export interface FermentationLetter extends JarPositioned {
  id: string;
  bodyText: string;
}

export interface FermentationWorksheet {
  id: string;
  worksheetMarkdown: string;
  resultDiagramMarkdown: string;
}

/** 発酵1件の詳細（手紙・言葉・抜粋・ワークシート）。 */
export interface FermentationDetail {
  id: string;
  questionId: string;
  targetPeriod: string;
  status: string;
  worksheet: FermentationWorksheet | null;
  snippets: FermentationSnippet[];
  keywords: FermentationKeyword[];
  letter: FermentationLetter | null;
}

/** 一覧 API が返す発酵の要約。詳細は重いので別途取得する。 */
export interface FermentationSummary {
  id: string;
  questionId: string;
  status: string;
  createdAt: string;
}

/** 瓶ビューでユーザーがドラッグして決めた要素の位置。 */
interface JarPositionItem {
  id: string;
  jarX: number;
  jarY: number;
}

/** 瓶ビュー全体の配置。まとめて PUT する。 */
export interface JarLayout {
  questions: JarPositionItem[];
  keywords: JarPositionItem[];
  snippets: JarPositionItem[];
  letters: JarPositionItem[];
}

/** 瓶に届いた手紙（＝完了した発酵）の受信箱1件。既読/未読は UnreadState 側が持つ。 */
export interface InboxLetter {
  questionId: string;
  questionText: string | null;
  fermentationId: string;
  createdAt: string;
}

/** 受信箱が手紙に見出しを付けるために要る問いの最小形。 */
export interface InboxQuestion {
  id: string;
  currentText: string | null;
}
