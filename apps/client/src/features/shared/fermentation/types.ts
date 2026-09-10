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

/**
 * 手紙のもとになった記録 1 件（Issue #453）。
 * 本文は重いので持たず、見出し（本文の先頭行）と日付だけ。
 */
export interface ScannedEntry {
  id: string;
  title: string;
  createdAt: string;
}

/** 発酵1件の詳細（手紙・言葉・抜粋・ワークシート・もとになった記録）。 */
export interface FermentationDetail {
  id: string;
  questionId: string;
  targetPeriod: string;
  status: string;
  worksheet: FermentationWorksheet | null;
  snippets: FermentationSnippet[];
  keywords: FermentationKeyword[];
  letter: FermentationLetter | null;
  scannedEntries: ScannedEntry[];
}

/** 一覧 API が返す発酵の要約。詳細は重いので別途取得する。 */
export interface FermentationSummary {
  id: string;
  questionId: string;
  status: string;
  createdAt: string;
  /**
   * 対象期間ラベル（'WEEK 35' 等）。一覧 API は元から返していたが、以前は誰も読んでいなかった。
   * 発酵履歴（Cover Flow）が円盤ごとの期間表示に使うので拾う。欠損時は空文字。
   */
  targetPeriod: string;
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

/**
 * 発酵瓶の readiness（issue #278）。問いごとの readiness の総和なので 0〜問いの数を取る。
 * 次回発火時刻や残り文字数は **意図的に含めない**（逆算できると「いつ来るか分からない」
 * という体験が壊れるため、サーバーも返さない）。
 */
export interface JarReadiness {
  /** いちばん進んだ問いの readiness（0〜1）。瓶の演出の段階を決める。 */
  top: number;
  /** 全問いの readiness の総和（0〜問いの数）。瓶の賑やかさを決める。 */
  total: number;
  questionCount: number;
}

/** 受信箱が手紙に見出しを付けるために要る問いの最小形。 */
export interface InboxQuestion {
  id: string;
  currentText: string | null;
}
