import type { EntryRepositoryGateway } from '../../../entry/domain/gateways/entry-repository.gateway.js';
import type {
  FermentationRepositoryGateway,
  FermentationResultWithDetails,
} from '../../domain/gateways/fermentation-repository.gateway.js';
import { FermentationNotFoundError } from '../errors/fermentation.errors.js';

/**
 * 手紙のもとになった記録 1 件（Issue #453）。
 * 本文は重いので返さず、見出し（先頭行）と日付だけを渡す。
 */
interface ScannedEntryView {
  id: string;
  title: string;
  createdAt: string;
}

export interface FermentationResultView extends FermentationResultWithDetails {
  scannedEntries: ScannedEntryView[];
}

/** 本文の先頭行を見出しとして使う（エディタの保存形式と同じ規則）。 */
const TITLE_MAX_LENGTH = 100;

function toTitle(content: string): string {
  const firstLine = content.split('\n').find((line) => line.trim().length > 0);
  return firstLine?.trim().substring(0, TITLE_MAX_LENGTH) ?? '';
}

export class GetFermentationResultUsecase {
  constructor(
    private fermentationRepo: FermentationRepositoryGateway,
    private entryRepo: EntryRepositoryGateway,
  ) {}

  async execute(id: string): Promise<FermentationResultView> {
    const result = await this.fermentationRepo.findByIdWithDetails(id);
    if (!result) throw new FermentationNotFoundError(id);

    // Issue #453: 手紙だけを見ても「何に対する返事か」が分からなかった。
    // 走査したエントリは fermentation_scanned_entries に残っているので一緒に返す。
    const scannedEntries =
      result.scannedEntryIds.length > 0
        ? (await this.entryRepo.findByIds(result.scannedEntryIds)).map((entry) => ({
            id: entry.id,
            title: toTitle(entry.content),
            createdAt: entry.createdAt,
          }))
        : [];

    return { ...result, scannedEntries };
  }
}
