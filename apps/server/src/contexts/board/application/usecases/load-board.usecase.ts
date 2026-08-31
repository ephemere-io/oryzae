import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { BoardCardRepositoryGateway } from '../../domain/gateways/board-card-repository.gateway.js';
import type { BoardPhotoRepositoryGateway } from '../../domain/gateways/board-photo-repository.gateway.js';
import type { BoardSnippetRepositoryGateway } from '../../domain/gateways/board-snippet-repository.gateway.js';
import type { BoardStorageGateway } from '../../domain/gateways/board-storage.gateway.js';
import { BoardCard } from '../../domain/models/board-card.js';

interface EntryContent {
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

interface CardResponse {
  id: string;
  cardType: 'entry' | 'snippet' | 'photo';
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
  content: EntryContent | SnippetContent | PhotoContent;
}

const TITLE_LENGTH = 100;
/**
 * カードに載せる抜粋の長さ。
 *
 * 200 文字だと既定サイズのカードでちょうど埋まってしまい、カードを大きくしても
 * 文字が増えず「途中で切れたまま」に見えていた。カードは掴んで広げられるので、
 * 広げたぶんは読めるようにしておく。全文を積むと盤面1枚ぶんの応答が重くなるので、
 * 読み物として足りる長さで止める（続きはカードの上で編集に入れば全文が出る）。
 */
const PREVIEW_LENGTH = 800;

interface LoadBoardResponse {
  dateKey: string;
  viewType: string;
  cards: CardResponse[];
}

export class LoadBoardUsecase {
  constructor(
    private boardCardRepo: BoardCardRepositoryGateway,
    private boardSnippetRepo: BoardSnippetRepositoryGateway,
    private boardPhotoRepo: BoardPhotoRepositoryGateway,
    private boardStorage: BoardStorageGateway,
    private entryRepo: EntryRepositoryGateway,
    private generateId: () => string,
  ) {}

  async execute(
    userId: string,
    dateKey: string,
    viewType: 'daily' | 'weekly' = 'daily',
    // tzOffset は受け取らない。日付でエントリを引くのをやめた（カードを自動で
    // 作らなくなった）ため、ここに暦日の判定は残っていない。境界の扱いは
    // ListPlaceableEntriesUsecase が引き継いでいる。
  ): Promise<LoadBoardResponse> {
    // 1. Load existing cards
    let existingCards = await this.boardCardRepo.findByDateAndView(userId, dateKey, viewType);

    // For weekly view, also include daily cards from the same week
    if (viewType === 'weekly') {
      const { startDate, endDate } = LoadBoardUsecase.weekRange(dateKey);
      const dailyCards = await this.boardCardRepo.findDailyCardsByDateRange(
        userId,
        startDate,
        endDate,
      );
      // Exclude daily cards whose refIds were soft-deleted in weekly view
      const deletedWeeklyRefIds = await this.boardCardRepo.findSoftDeletedRefIdsByDateAndView(
        userId,
        dateKey,
        viewType,
      );
      const deletedWeeklySet = new Set(deletedWeeklyRefIds);
      // Merge, avoiding duplicates by refId+cardType and excluding soft-deleted weekly cards
      const existingKeys = new Set(existingCards.map((c) => `${c.cardType}:${c.refId}`));
      const uniqueDailyCards = dailyCards.filter(
        (c) => !existingKeys.has(`${c.cardType}:${c.refId}`) && !deletedWeeklySet.has(c.refId),
      );
      // Create weekly copies of daily cards so positions are independent per view
      const weeklyCopies: BoardCard[] = [];
      for (const dailyCard of uniqueDailyCards) {
        const result = BoardCard.create(
          {
            userId,
            cardType: dailyCard.cardType,
            refId: dailyCard.refId,
            dateKey,
            viewType: 'weekly',
            x: dailyCard.x,
            y: dailyCard.y,
            rotation: dailyCard.rotation,
            width: dailyCard.width,
            height: dailyCard.height,
            zIndex: existingCards.length + weeklyCopies.length,
          },
          this.generateId,
        );
        if (result.success) {
          weeklyCopies.push(result.value);
        }
      }
      if (weeklyCopies.length > 0) {
        await this.boardCardRepo.saveMany(weeklyCopies);
      }
      existingCards = [...existingCards, ...weeklyCopies];
    }

    // エントリのカードは**自動では作らない**。以前はその日/その週に書いた日記を
    // 勝手に盤面へ並べていたが、置いた覚えのないカードが現れる一方で、消し方も
    // 見えなかった。今は ListPlaceableEntriesUsecase で候補を出し、利用者が
    // 選んで置く（PlaceEntryCardUsecase）。既に置かれているカードはそのまま残る。

    const allCards = existingCards;

    // 3. Hydrate content
    const cardResponses = await this.hydrateCards(allCards);

    return { dateKey, viewType, cards: cardResponses };
  }

  private async hydrateCards(cards: BoardCard[]): Promise<CardResponse[]> {
    // Collect refIds by type
    const entryRefIds = cards.filter((c) => c.cardType === 'entry').map((c) => c.refId);
    const snippetRefIds = cards.filter((c) => c.cardType === 'snippet').map((c) => c.refId);
    const photoRefIds = cards.filter((c) => c.cardType === 'photo').map((c) => c.refId);

    // Fetch entry content (batch)
    const entryMap = new Map<string, EntryContent>();
    if (entryRefIds.length > 0) {
      const entries = await this.entryRepo.findByIds(entryRefIds);
      for (const entry of entries) {
        const content = entry.content;
        const firstLine = content.split('\n').find((l) => l.trim().length > 0);
        entryMap.set(entry.id, {
          title: firstLine?.substring(0, TITLE_LENGTH) ?? '',
          preview: content.substring(0, PREVIEW_LENGTH),
          createdAt: entry.createdAt,
        });
      }
    }

    // Fetch snippet content
    const snippetMap = new Map<string, SnippetContent>();
    if (snippetRefIds.length > 0) {
      const snippets = await this.boardSnippetRepo.findByIds(snippetRefIds);
      for (const snippet of snippets) {
        snippetMap.set(snippet.id, { text: snippet.text });
      }
    }

    // Fetch photo content
    const photoMap = new Map<string, PhotoContent>();
    if (photoRefIds.length > 0) {
      const photos = await this.boardPhotoRepo.findByIds(photoRefIds);
      // board-photos は非公開バケットなので、表示用に署名付き URL をまとめて発行する。
      const signedUrls = await this.boardStorage.getSignedUrls(photos.map((p) => p.storagePath));
      for (const photo of photos) {
        const imageUrl = signedUrls.get(photo.storagePath);
        // 署名できなかった写真はカードごと落とす（実体が消えている等）。
        if (!imageUrl) continue;
        photoMap.set(photo.id, { imageUrl, caption: photo.caption });
      }
    }

    return cards
      .map((card) => {
        let content: EntryContent | SnippetContent | PhotoContent | undefined;
        if (card.cardType === 'entry') {
          content = entryMap.get(card.refId);
        } else if (card.cardType === 'snippet') {
          content = snippetMap.get(card.refId);
        } else if (card.cardType === 'photo') {
          content = photoMap.get(card.refId);
        }
        if (!content) return null;

        return {
          id: card.id,
          cardType: card.cardType,
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

  private static weekRange(dateKey: string): { startDate: string; endDate: string } {
    const d = new Date(`${dateKey}T00:00:00`);
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const fmt = (dt: Date) => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };

    return { startDate: fmt(monday), endDate: fmt(sunday) };
  }
}
