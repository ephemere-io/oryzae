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

/** 盤面に置ける日記の候補（その日/その週に書いたもの）。 */
export interface PlaceableEntry {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  /** すでに盤面にあるか。置かれていても一覧からは消さず、状態として見せる。 */
  placed: boolean;
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
