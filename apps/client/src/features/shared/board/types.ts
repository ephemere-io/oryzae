/** ボード（日付ごとの自由配置ビュー）の共有型（端末非依存）。 */

interface SnippetContent {
  text: string;
}

interface PhotoContent {
  imageUrl: string;
  caption: string;
}

/**
 * 新規カードを置く world 座標。
 *
 * 盤面がパン・ズームできるようになったため、サーバーの既定（固定範囲のランダム）では
 * 遠くを見ているときに画面外へ生まれてしまう。作成時に「いま見えている場所」を渡す。
 */
export interface CardPlacement {
  x: number;
  y: number;
}

/** ボード上に置かれた1枚のカード。 */
export interface BoardCardData {
  id: string;
  cardType: 'snippet' | 'photo';
  refId: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
  /**
   * 利用者が自分で位置を決めたカードか。
   * false のカードだけを作成日時順に自動整列する（applyDefaultZOrder）。
   */
  userPositioned: boolean;
  createdAt: string;
  content: SnippetContent | PhotoContent;
  removing?: boolean;
}

/**
 * 画像 OCR（画像を読み取ってスニペット本文にする）の結果。
 *
 * 失敗を throw ではなく値で返す。ボードには専用のエラー表示が無く、呼び出し側
 * （スニペット作成ダイアログ）が「読み取れなかった」と「失敗した」をその場の
 * メッセージとして出し分けたいため。
 */
export type SnippetOcrResult =
  | { status: 'ok'; text: string }
  /** 通信はできたが、画像から文字を1つも読み取れなかった。 */
  | { status: 'empty' }
  /** 通信・サーバー側の失敗（サイズ超過・対応外形式・API エラー等）。 */
  | { status: 'failed' };

/**
 * 書斎の壁が読む「いま貼ってあるもの」（`GET /api/v1/board/summary`）。
 *
 * 盤面（1 日・1 週）とは別に、**全期間の総量**を持つ。壁に描くのは上限までだが、
 * ラベルが名乗るのは本当の数（棚が冊数を言うのと同じ）。
 */
export interface BoardSummary {
  total: number;
  /** 内訳。書斎のホバーが「写真 3 件・スニペット 12 件」と名乗るのに使う。 */
  snippets: number;
  photos: number;
  /** 新しい順。サーバー側で上限まで絞ってある。 */
  cards: BoardCardData[];
}
