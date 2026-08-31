import type { BoardCardData } from '@/features/shared/board/types';

/**
 * ボード API レスポンスの正規化。
 *
 * `res.json()` は型なし。`const data: BoardData = await res.json()` は `as` と実質同じ
 * 型アサーションで、`cards` を欠くレスポンス（エラーエンベロープ・スキーマ変更）が来ると
 * 直後の z-order 計算が `undefined.length` で落ちる。しかも呼び出し元は useEffect 内の
 * async 関数なので未処理 rejection として握り潰され、`setLoading(false)` にも到達せず
 * ボードがロード表示のまま固まる。
 *
 * `features/shared/fermentation/normalize.ts` と同じ「**厳しい方に寄せる**」方針:
 * 配列でなければ空、必須フィールド（id / 座標 / 寸法）を満たさない要素は落とす。
 */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function cardType(value: unknown): BoardCardData['cardType'] | null {
  return value === 'entry' || value === 'snippet' || value === 'photo' ? value : null;
}

/**
 * content は種別ごとに形が違う。描画側（BoardCard）は `'title' in content` のような
 * プロパティ判別で narrow するので、種別に対応する形をここで組み立てて渡す。
 */
function cardContent(
  type: BoardCardData['cardType'],
  raw: Record<string, unknown>,
): BoardCardData['content'] {
  if (type === 'entry') {
    return { title: str(raw.title), preview: str(raw.preview), createdAt: str(raw.createdAt) };
  }
  if (type === 'snippet') return { text: str(raw.text) };
  return { imageUrl: str(raw.imageUrl), caption: str(raw.caption) };
}

/** レスポンス全体からカード配列を取り出して正規化する。 */
export function normalizeBoardCards(input: unknown): BoardCardData[] {
  if (!isObject(input) || !Array.isArray(input.cards)) return [];

  const out: BoardCardData[] = [];
  for (const raw of input.cards) {
    if (!isObject(raw)) continue;
    // id / refId / content はカードの同一性と描画の前提。欠けていたら描けないので落とす。
    if (typeof raw.id !== 'string' || typeof raw.refId !== 'string') continue;
    if (!isObject(raw.content)) continue;
    const type = cardType(raw.cardType);
    if (type === null) continue;

    out.push({
      id: raw.id,
      cardType: type,
      refId: raw.refId,
      // 座標・寸法は欠けても盤面に置けるので既定値に潰す（カードごと落とすほどではない）。
      x: num(raw.x, 0),
      y: num(raw.y, 0),
      rotation: num(raw.rotation, 0),
      width: num(raw.width, 200),
      height: num(raw.height, 160),
      zIndex: num(raw.zIndex, 0),
      // 列を足す前のサーバーからは来ないので false に倒す（＝自動整列の対象）。
      userPositioned: raw.userPositioned === true,
      createdAt: str(raw.createdAt),
      content: cardContent(type, raw.content),
    });
  }
  return out;
}
