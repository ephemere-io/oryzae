import { getTranslations } from 'next-intl/server';
import { APP_ICON_SVG, BRAND_NAME, svgDataUri } from '@/lib/brand';

/**
 * スマートフォンでアクセスされたときに全画面を覆う暫定オーバーレイ。
 * スマホ専用画面が用意できるまでの措置 (Issue #299)。
 *
 * - CSS メディアクエリのみで制御。JS による UA 判定は行わない。
 * - 判定式: `(max-width: 767px) AND (pointer: coarse)`
 *   - 画面幅 < md (768px) かつ
 *   - 主入力デバイスがタッチ (coarse pointer)
 * - 両方の AND を取ることで、PC でブラウザサイドバー (Brave 等) を開いて
 *   viewport が 768px を下回ったケースや、PC で高ズーム率にしたケースを除外する。
 *   PC のマウスは `pointer: fine` なので、たとえ幅が狭くてもオーバーレイは出ない。
 * - 全ルートで効くように `app/layout.tsx` の body 直下に置く。
 * - サーバーコンポーネントとして翻訳を取り、SSR で確定するためフリッカーは発生しない。
 */
export async function DesktopOnlyOverlay() {
  const t = await getTranslations('app.desktop_only');

  return (
    <div
      role="alert"
      aria-live="polite"
      className="hidden [@media(max-width:767px)_and_(pointer:coarse)]:flex fixed inset-0 z-[9999] flex-col items-center justify-center gap-6 bg-[var(--bg)] px-8 text-center text-[var(--fg)]"
    >
      {/* biome-ignore lint/performance/noImgElement: small inline brand mark, no need for next/image optimization */}
      <img src={svgDataUri(APP_ICON_SVG)} alt="" width={72} height={72} className="opacity-90" />
      <div className="flex flex-col gap-3">
        <p className="text-sm tracking-[0.2em] uppercase opacity-70">{BRAND_NAME}</p>
        <h1 className="text-xl font-semibold">{t('heading')}</h1>
        <p className="max-w-xs text-sm leading-relaxed opacity-80">{t('body')}</p>
      </div>
    </div>
  );
}
