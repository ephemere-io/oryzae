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
