import { cleanup, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import { StudyWordTooltip } from '@/features/shared/study/components/study-word-tooltip';
import messages from '@/i18n/messages/ja.json';

/**
 * 「触れていなければ何も出さない」だけをここで見る。
 *
 * 描画物が無い状態は検証ハーネスに乗らない（契約ノードを出せないので dom-contract が
 * 成立しない）。出ているときの中身は `study-word-tooltip.verify.tsx` が見る。
 */
function renderTooltip(word: string | null) {
  return render(
    <NextIntlClientProvider locale="ja" messages={messages}>
      <StudyWordTooltip word={word} question="続ける意味とは" screen={{ x: 10, y: 20 }} />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe('StudyWordTooltip', () => {
  it('触れていなければ何も描かない', () => {
    // 指が離れても貼り付いたままだと、瓶の上に説明が残り続ける。
    const { container } = renderTooltip(null);
    expect(container.innerHTML).toBe('');
  });

  it('触れていれば語を描く', () => {
    const { container } = renderTooltip('余白');
    expect(container.innerHTML).not.toBe('');
    expect(container.textContent).toContain('余白');
  });
});
