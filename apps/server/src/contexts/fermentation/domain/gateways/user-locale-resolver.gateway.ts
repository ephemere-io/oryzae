import type { FermentationLanguage } from '../services/fermentation-eligibility.service.js';

// 発酵プロセスの文字数閾値判定で使うユーザー言語を取得する抽象。
// 実装は Supabase Auth user_metadata.locale を読む。
// 不明・未設定時は 'ja' をデフォルトとする (Oryzae のメインターゲット)。
export interface UserLocaleResolverGateway {
  resolve(userId: string): Promise<FermentationLanguage>;
}
