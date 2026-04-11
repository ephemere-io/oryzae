import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { BoardCardRepositoryGateway } from '../../domain/gateways/board-card-repository.gateway.js';
import type { BoardSnippetRepositoryGateway } from '../../domain/gateways/board-snippet-repository.gateway.js';
import { BoardCard } from '../../domain/models/board-card.js';

interface EntryContent {
  title: string;
  preview: string;
  createdAt: string;
}

interface SnippetContent {
  text: string;
}

interface CardResponse {
  id: string;
  cardType: 'entry' | 'snippet';
  refId: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
  content: EntryContent | SnippetContent;
}

interface LoadBoardResponse {
  dateKey: string;
  viewType: string;
  cards: CardResponse[];
}

const DEFAULT_ENTRY_WIDTH = 340;
const DEFAULT_ENTRY_HEIGHT = 280;

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export class LoadBoardUsecase {
  constructor(
    private boardCardRepo: BoardCardRepositoryGateway,
    private boardSnippetRepo: BoardSnippetRepositoryGateway,
    private entryRepo: EntryRepositoryGateway,
    private generateId: () => string,
  ) {}

  async execute(userId: string, dateKey: string): Promise<LoadBoardResponse> {
    const viewType = 'daily';

    // 1. Load existing cards
    const existingCards = await this.boardCardRepo.findByDateAndView(userId, dateKey, viewType);

    // 2. Auto-populate entries that don't have cards yet
    const existingEntryRefIds = await this.boardCardRepo.findRefIdsByDateAndView(
      userId,
      dateKey,
      viewType,
      'entry',
    );
    const existingRefIdSet = new Set(existingEntryRefIds);

    const entries = await this.entryRepo.listByUserIdAndDate(userId, dateKey);
    const newCards: BoardCard[] = [];

    for (const entry of entries) {
      if (existingRefIdSet.has(entry.id)) continue;

      const result = BoardCard.create(
        {
          userId,
          cardType: 'entry',
          refId: entry.id,
          dateKey,
          viewType,
          x: randomBetween(60, 800),
          y: randomBetween(60, 600),
          rotation: Math.round((Math.random() * 10 - 5) * 10) / 10,
          width: DEFAULT_ENTRY_WIDTH,
          height: DEFAULT_ENTRY_HEIGHT,
          zIndex: existingCards.length + newCards.length,
        },
        this.generateId,
      );
      if (result.success) {
        newCards.push(result.value);
      }
    }

    if (newCards.length > 0) {
      await this.boardCardRepo.saveMany(newCards);
    }

    const allCards = [...existingCards, ...newCards];

    // 3. Hydrate content
    const cardResponses = await this.hydrateCards(allCards);

    return { dateKey, viewType, cards: cardResponses };
  }

  private async hydrateCards(cards: BoardCard[]): Promise<CardResponse[]> {
    // Collect refIds by type
    const entryRefIds = cards.filter((c) => c.cardType === 'entry').map((c) => c.refId);
    const snippetRefIds = cards.filter((c) => c.cardType === 'snippet').map((c) => c.refId);

    // Fetch entry content
    const entryMap = new Map<string, EntryContent>();
    for (const refId of entryRefIds) {
      const entry = await this.entryRepo.findById(refId);
      if (entry) {
        const content = entry.content;
        const lines = content.split('\n').filter((l) => l.trim().length > 0);
        entryMap.set(refId, {
          title: lines[0]?.substring(0, 100) ?? '',
          preview: content.substring(0, 100),
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

    return cards
      .map((card) => {
        let content: EntryContent | SnippetContent | undefined;
        if (card.cardType === 'entry') {
          content = entryMap.get(card.refId);
        } else if (card.cardType === 'snippet') {
          content = snippetMap.get(card.refId);
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
          content,
        };
      })
      .filter((c): c is CardResponse => c !== null);
  }
}
