import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserLocaleResolverGateway } from '../../domain/gateways/user-locale-resolver.gateway.js';
import type { FermentationLanguage } from '../../domain/services/fermentation-eligibility.service.js';

// Supabase Auth の user_metadata.locale を読んで FermentationLanguage を返す。
// signup 時に server 側で `data: { locale }` として保存される (auth.ts 参照)。
// service-role クライアントを必要とする (auth.admin.getUserById)。
//
// UI は 4 言語 (ja/en/zh/ko) をサポートするが、発酵レター等の LLM プロンプトは
// 現状 ja/en のみ対応のため、zh/ko ユーザーは en にフォールバックする (Issue #308)。
export class SupabaseUserLocaleResolver implements UserLocaleResolverGateway {
  constructor(private serviceSupabase: SupabaseClient) {}

  async resolve(userId: string): Promise<FermentationLanguage> {
    try {
      const { data, error } = await this.serviceSupabase.auth.admin.getUserById(userId);
      if (error || !data.user) return 'ja';
      const meta = data.user.user_metadata;
      if (meta && typeof meta === 'object' && 'locale' in meta) {
        const locale = (meta as { locale: unknown }).locale;
        if (locale === 'en') return 'en';
        if (locale === 'ja') return 'ja';
        // zh / ko ユーザーは en プロンプトを使用 (LLM 側未対応のためフォールバック)。
        if (locale === 'zh' || locale === 'ko') return 'en';
      }
      return 'ja';
    } catch {
      // ロケール解決の失敗で発酵パイプライン全体を止めないため、デフォルトに倒す。
      return 'ja';
    }
  }
}
