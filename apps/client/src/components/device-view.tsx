'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useDevice } from '@/lib/use-device';

interface DeviceViewProps {
  /** PC 端末で描画する内容（必須）。 */
  pc: ReactNode;
  /** SP 端末で描画する内容。省略時は spFallback（既定は「スマホ未対応」表示）。 */
  sp?: ReactNode;
  /** sp 未提供の画面を SP 端末で開いたときの表示。 */
  spFallback?: ReactNode;
}

/**
 * 端末で出し分ける唯一のプリミティブ（Issue #363 / ハーネス）。
 * 保護ルートの page はこれ経由で PC/SP を出し分ける。
 *
 * 安全既定: SP 端末で `sp` を渡し忘れても、PC コンポーネントを SP シェルに描画して
 * レイアウトを壊すことはなく、明示的な「スマホ未対応」表示にフォールバックする。
 * 判定前(null)は何も描画しない（サイドバー等のちらつき防止）。
 */
export function DeviceView({ pc, sp, spFallback }: DeviceViewProps) {
  const device = useDevice();
  if (device === null) return null;
  if (device === 'sp') return <>{sp ?? spFallback ?? <SpUnsupported />}</>;
  return <>{pc}</>;
}

function SpUnsupported() {
  const t = useTranslations('sp');
  return (
    <div className="flex h-full items-center justify-center p-8 text-center text-sm opacity-60">
      {t('unsupported')}
    </div>
  );
}
