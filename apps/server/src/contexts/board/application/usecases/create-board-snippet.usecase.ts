import type { BoardCardRepositoryGateway } from '../../domain/gateways/board-card-repository.gateway.js';
import type { BoardSnippetRepositoryGateway } from '../../domain/gateways/board-snippet-repository.gateway.js';
import { BoardCard } from '../../domain/models/board-card.js';
import { BoardSnippet } from '../../domain/models/board-snippet.js';
import { BoardCardValidationError, BoardSnippetValidationError } from '../errors/board.errors.js';

interface CreateBoardSnippetInput {
  text: string;
  dateKey: string;
  viewType?: 'daily' | 'weekly';
}

interface CreateBoardSnippetResponse {
  snippetId: string;
  cardId: string;
  text: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  zIndex: number;
}

const DEFAULT_WIDTH = 262;
const DEFAULT_HEIGHT = 120;

/* --- 本文の量からカードの高さを見積もる --- */

/** p-6 の内側に残る幅。SnippetCardContent の padding と揃えている。 */
const CONTENT_WIDTH = DEFAULT_WIDTH - 48;
/** 本文は text-sm / line-height 1.8。 */
const LINE_HEIGHT = 14 * 1.8;
/** 全角なら 1 文字 ≒ 14px なので、1行に入るのはこれくらい。 */
const CHARS_PER_LINE = Math.floor(CONTENT_WIDTH / 14);
/** 上下の padding(48) と、SNIPPET バッジの行(24)。 */
const CHROME_HEIGHT = 48 + 24;
/** これ以上は盤面を覆ってしまうので伸ばさない（溢れる分はカード内で送る）。 */
const MAX_HEIGHT = 480;

/**
 * 本文が長くても切れないように、行数ぶんカードを伸ばす。
 *
 * 以前は本文を 50 文字に制限し、カードは 262x120 固定だった。制限を外すなら
 * 器も伸びないと、カードの overflow:hidden に隠れて読めなくなる。
 * 改行も 1 行として数える（見積もりなので厳密でなくてよい。ユーザーは掴んで
 * リサイズできるし、収まらない分はカードの中で送れる）。
 */
function estimateHeight(text: string): number {
  const lines = text
    .split('\n')
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / CHARS_PER_LINE)), 0);
  const needed = CHROME_HEIGHT + Math.ceil(lines * LINE_HEIGHT);
  return Math.min(MAX_HEIGHT, Math.max(DEFAULT_HEIGHT, needed));
}

export class CreateBoardSnippetUsecase {
  constructor(
    private boardSnippetRepo: BoardSnippetRepositoryGateway,
    private boardCardRepo: BoardCardRepositoryGateway,
    private generateId: () => string,
  ) {}

  async execute(
    userId: string,
    input: CreateBoardSnippetInput,
  ): Promise<CreateBoardSnippetResponse> {
    const snippetResult = BoardSnippet.create({ userId, text: input.text }, this.generateId);
    if (!snippetResult.success) {
      throw new BoardSnippetValidationError(snippetResult.error.message);
    }
    const snippet = snippetResult.value;

    const x = Math.floor(Math.random() * 741) + 60;
    const y = Math.floor(Math.random() * 541) + 60;
    const rotation = Math.round((Math.random() * 10 - 5) * 10) / 10;
    const vt = input.viewType ?? 'daily';

    // New cards should appear on top of existing ones
    const maxZ = await this.boardCardRepo.findMaxZIndex(userId, input.dateKey, vt);

    const cardResult = BoardCard.create(
      {
        userId,
        cardType: 'snippet',
        refId: snippet.id,
        dateKey: input.dateKey,
        viewType: vt,
        x,
        y,
        rotation,
        width: DEFAULT_WIDTH,
        height: estimateHeight(input.text),
        zIndex: maxZ + 1,
      },
      this.generateId,
    );
    if (!cardResult.success) {
      throw new BoardCardValidationError(cardResult.error.message);
    }
    const card = cardResult.value;

    await this.boardSnippetRepo.save(snippet);
    await this.boardCardRepo.saveMany([card]);

    return {
      snippetId: snippet.id,
      cardId: card.id,
      text: snippet.text,
      x: card.x,
      y: card.y,
      rotation: card.rotation,
      width: card.width,
      height: card.height,
      zIndex: card.zIndex,
    };
  }
}
