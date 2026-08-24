import type { PhotoTranscriptionUsage } from '../models/photo-transcription-usage.js';

/** 文字起こしのトークン使用量の記録先。集計は管理画面が SQL 側で行う。 */
export interface PhotoTranscriptionUsageRepositoryGateway {
  save(usage: PhotoTranscriptionUsage): Promise<void>;
}
