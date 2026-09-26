'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useHelpMode } from '../help-context';
import { HelpToggleButton } from './help-toggle-button';

/** 「?」が右上に占めている幅を配る変数。同じ席の物（問いの変遷）がこれだけ左へ寄る。 */
const RESERVE_VAR = '--help-toggle-reserve';
const RESERVE_PX = 48;

/**
 * 画面の右上の「?」（配線）。ヘルプモードが有効な間だけ居る。
 *
 * 右上に居る他の物（瓶の画面の「問いの変遷」）には `--help-toggle-reserve` で席を空けさせる。
 * import で結ばずに CSS 変数で伝えるのは、面の幅（`--help-width`）と同じ理由 — 右上に
 * 何が居るかを、それぞれの部品が知らなくて済む。
 */
// verify-exempt: ヘルプの context 依存の配線。見た目と契約は HelpToggleButton が孤立検証に乗る
export function HelpToggle() {
  const help = useHelpMode();
  const t = useTranslations('help');

  useEffect(() => {
    if (!help.enabled) return;
    document.documentElement.style.setProperty(RESERVE_VAR, `${RESERVE_PX}px`);
    return () => {
      document.documentElement.style.setProperty(RESERVE_VAR, '0px');
    };
  }, [help.enabled]);

  if (!help.enabled) return null;

  return (
    <HelpToggleButton
      open={help.open}
      cue={help.cue}
      label={t('toggle')}
      onClick={help.toggleHelp}
    />
  );
}
