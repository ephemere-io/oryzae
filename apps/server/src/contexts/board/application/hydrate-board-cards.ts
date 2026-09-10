import type { BoardPhotoRepositoryGateway } from '../domain/gateways/board-photo-repository.gateway.js';
import type { BoardSnippetRepositoryGateway } from '../domain/gateways/board-snippet-repository.gateway.js';
import type { BoardStorageGateway } from '../domain/gateways/board-storage.gateway.js';
import type { BoardCard } from '../domain/models/board-card.js';

interface SnippetContent {
  text: string;
}

interface PhotoContent {
  imageUrl: string;
  caption: string;
}

export interface CardResponse {
  id: string;
  cardType: 'snippet' | 'photo';
  refId: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
  /** 利用者が自分で位置を決めたカードか。クライアントの自動整列の対象外になる。 */
  userPositioned: boolean;
  createdAt: string;
  content: SnippetContent | PhotoContent;
}

export interface HydrateDeps {
  snippetRepo: BoardSnippetRepositoryGateway;
  photoRepo: BoardPhotoRepositoryGateway;
  storage: BoardStorageGateway;
}

/**
 * カードの見出し（付箋の本文・写真の URL）を詰める。
 *
 * **盤面の読み込みと書斎の壁が同じものを使う。** どちらも「カードの並び + 中身」を
 * 返すが、集め方だけが違う（片方は日付で、もう片方は全期間の新しい順）。詰め方まで
 * 二重に持つと、写真の署名や落とし方の判断が片方だけ古くなる。
 *
 * 中身を引けなかったカードは**落とす**（実体が消えている等）。空の枠を返すより、
 * 無いものとして扱うほうが盤面の見た目が壊れない。
 */
export async function hydrateBoardCards(
  deps: HydrateDeps,
  cards: BoardCard[],
): Promise<CardResponse[]> {
  // Collect refIds by type
  const snippetRefIds = cards.filter((c) => c.cardType === 'snippet').map((c) => c.refId);
  const photoRefIds = cards.filter((c) => c.cardType === 'photo').map((c) => c.refId);

  // Fetch snippet content
  const snippetMap = new Map<string, SnippetContent>();
  if (snippetRefIds.length > 0) {
    const snippets = await deps.snippetRepo.findByIds(snippetRefIds);
    for (const snippet of snippets) {
      snippetMap.set(snippet.id, { text: snippet.text });
    }
  }

  // Fetch photo content
  const photoMap = new Map<string, PhotoContent>();
  if (photoRefIds.length > 0) {
    const photos = await deps.photoRepo.findByIds(photoRefIds);
    // board-photos は非公開バケットなので、表示用に署名付き URL をまとめて発行する。
    const signedUrls = await deps.storage.getSignedUrls(photos.map((p) => p.storagePath));
    for (const photo of photos) {
      const imageUrl = signedUrls.get(photo.storagePath);
      // 署名できなかった写真はカードごと落とす（実体が消えている等）。
      if (!imageUrl) continue;
      photoMap.set(photo.id, { imageUrl, caption: photo.caption });
    }
  }

  return cards
    .map((card) => {
      let content: SnippetContent | PhotoContent | undefined;
      if (card.cardType === 'snippet') {
        content = snippetMap.get(card.refId);
      } else if (card.cardType === 'photo') {
        content = photoMap.get(card.refId);
      }
      if (!content) return null;

      return {
        id: card.id,
        cardType: card.cardType === 'photo' ? 'photo' : 'snippet',
        refId: card.refId,
        x: card.x,
        y: card.y,
        rotation: card.rotation,
        width: card.width,
        height: card.height,
        zIndex: card.zIndex,
        userPositioned: card.userPositioned,
        createdAt: card.createdAt,
        content,
      };
    })
    .filter((c): c is CardResponse => c !== null);
}
