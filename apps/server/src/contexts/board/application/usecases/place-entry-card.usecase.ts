import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type { BoardCardRepositoryGateway } from '../../domain/gateways/board-card-repository.gateway.js';
import { BoardCard } from '../../domain/models/board-card.js';
import { BoardCardValidationError, BoardEntryNotFoundError } from '../errors/board.errors.js';

interface PlaceEntryCardInput {
  entryId: string;
  dateKey: string;
  viewType?: 'daily' | 'weekly';
}

interface PlaceEntryCardResponse {
  cardId: string;
  refId: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
}

const DEFAULT_WIDTH = 340;
const DEFAULT_HEIGHT = 280;

/**
 * 選んだ日記を盤面に置く。
 *
 * 以前は LoadBoardUsecase が期間内の日記を勝手にカード化していた。置いた覚えの
 * ないものが現れる一方で外し方は見えず、盤面が「自分で組み立てる場所」になって
 * いなかった。置くのは利用者の操作で、外すのは既存の DELETE /cards/:id。
 */
export class PlaceEntryCardUsecase {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private boardCardRepo: BoardCardRepositoryGateway,
    private generateId: () => string,
  ) {}

  async execute(userId: string, input: PlaceEntryCardInput): Promise<PlaceEntryCardResponse> {
    // 他人の日記 ID を渡されても置けないようにする。RLS でも守られるが、
    // 盤面のカードは自分の行として作れてしまうため、ここで持ち主を確かめる。
    const entry = await this.entryRepo.findById(input.entryId);
    if (!entry || entry.userId !== userId) {
      throw new BoardEntryNotFoundError(input.entryId);
    }

    const vt = input.viewType ?? 'daily';

    // 同じ日記を二重に置かない。生きているカードだけを見るので、いったん外した
    // ものは置き直せる。
    const existing = await this.boardCardRepo.findByDateAndView(userId, input.dateKey, vt);
    const already = existing.find((c) => c.cardType === 'entry' && c.refId === input.entryId);
    if (already) {
      return {
        cardId: already.id,
        refId: already.refId,
        x: already.x,
        y: already.y,
        rotation: already.rotation,
        width: already.width,
        height: already.height,
        zIndex: already.zIndex,
      };
    }

    const maxZ = await this.boardCardRepo.findMaxZIndex(userId, input.dateKey, vt);

    // いったん外したものを置き直す場合は「復活」で扱う。board_cards は
    // (user_id, ref_id, date_key, view_type) が一意で、外しても行が残るため、
    // 新しい行を insert しようとすると saveMany の upsert が
    // ignoreDuplicates: true で**黙って何も書かない**（201 は返るのにカードは出ない）。
    const removed = await this.boardCardRepo.findSoftDeletedByRefId(
      userId,
      input.entryId,
      input.dateKey,
      vt,
    );
    if (removed) {
      await this.boardCardRepo.restore(removed.id, userId, maxZ + 1);
      return {
        cardId: removed.id,
        refId: removed.refId,
        // 位置は外す前のまま戻す（また同じところに置き直す手間をかけさせない）。
        x: removed.x,
        y: removed.y,
        rotation: removed.rotation,
        width: removed.width,
        height: removed.height,
        zIndex: maxZ + 1,
      };
    }

    const result = BoardCard.create(
      {
        userId,
        cardType: 'entry',
        refId: input.entryId,
        dateKey: input.dateKey,
        viewType: vt,
        x: Math.floor(Math.random() * 741) + 60,
        y: Math.floor(Math.random() * 541) + 60,
        rotation: Math.round((Math.random() * 10 - 5) * 10) / 10,
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        zIndex: maxZ + 1,
      },
      this.generateId,
    );
    if (!result.success) {
      throw new BoardCardValidationError(result.error.message);
    }
    const card = result.value;
    await this.boardCardRepo.saveMany([card]);

    return {
      cardId: card.id,
      refId: card.refId,
      x: card.x,
      y: card.y,
      rotation: card.rotation,
      width: card.width,
      height: card.height,
      zIndex: card.zIndex,
    };
  }
}
