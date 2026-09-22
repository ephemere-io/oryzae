'use client';

import { useHelpMode } from '../help-context';
import { HelpWelcome } from './help-welcome';

/**
 * 初めての人にだけ、面が開いている間、「ようこそ」を出す（配線）。
 * 押すと晴れる。面を閉じても晴れる（閉じたことは context が記録する）。
 */
// verify-exempt: ヘルプの context 依存の配線。見た目と契約は HelpWelcome が孤立検証に乗る
export function HelpWelcomeGate({ guide }: { guide: 'right' | 'below' }) {
  const help = useHelpMode();
  if (!help.welcome) return null;
  return <HelpWelcome guide={guide} onStart={help.dismissWelcome} />;
}
