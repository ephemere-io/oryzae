import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { BoardCardRepositoryGateway } from '../../domain/gateways/board-card-repository.gateway.js';

interface PlaceableEntry {
  id: string;
  title: string;
  preview: string;
  createdAt: string;
  /** すでに盤面に置かれているか。置かれていても一覧には出す（状態が見えたほうがよい）。 */
  placed: boolean;
}

interface ListPlaceableEntriesResponse {
  entries: PlaceableEntry[];
}

const TITLE_LENGTH = 100;
const PREVIEW_LENGTH = 200;

/** 盤面のカードと同じ作り方で見出しと抜粋を出す（LoadBoardUsecase.hydrateCards と対応）。 */
function summarize(content: string): { title: string; preview: string } {
  const firstLine = content.split('\n').find((l) => l.trim().length > 0);
  return {
    title: firstLine?.substring(0, TITLE_LENGTH) ?? '',
    preview: content.substring(0, PREVIEW_LENGTH),
  };
}

/**
 * その日（または週）に書いた日記のうち、盤面に置ける候補を返す。
 *
 * 以前は LoadBoardUsecase が同じ一覧を取って**勝手にカードを作っていた**。
 * 置いた覚えのないカードが現れ、しかも消し方が見えないという状態だったので、
 * 「候補を出す」と「置く」を分けた。ここは前者だけを担う。
 */
export class ListPlaceableEntriesUsecase {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private boardCardRepo: BoardCardRepositoryGateway,
  ) {}

  async execute(
    userId: string,
    dateKey: string,
    viewType: 'daily' | 'weekly' = 'daily',
    /** 利用者のローカル暦日を UTC 区間に直すためのオフセット（getTimezoneOffset 同符号）。 */
    tzOffsetMinutes = 0,
  ): Promise<ListPlaceableEntriesResponse> {
    const entries =
      viewType === 'weekly'
        ? await this.entryRepo.listByUserIdAndWeek(userId, dateKey, tzOffsetMinutes)
        : await this.entryRepo.listByUserIdAndDate(userId, dateKey, tzOffsetMinutes);

    // 「置かれている」は生きているカードだけを見る。findByDateAndView は
    // is_deleted=false で絞るので、いったん外したエントリはまた置ける。
    const cards = await this.boardCardRepo.findByDateAndView(userId, dateKey, viewType);
    const placedRefIds = new Set(cards.filter((c) => c.cardType === 'entry').map((c) => c.refId));

    return {
      entries: entries
        .map((entry) => ({
          id: entry.id,
          ...summarize(entry.content),
          createdAt: entry.createdAt,
          placed: placedRefIds.has(entry.id),
        }))
        // 新しいものを上に。盤面と違い、ここは読んで選ぶための一覧なので時系列が自然。
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    };
  }
}
