/** ボード（日付ごとの自由配置ビュー）の共有型（端末非依存）。 */

export interface EntryContent {
  title: string;
  preview: string;
  createdAt: string;
}

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
  cardType: 'entry' | 'snippet' | 'photo';
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
  content: EntryContent | SnippetContent | PhotoContent;
  removing?: boolean;
}
