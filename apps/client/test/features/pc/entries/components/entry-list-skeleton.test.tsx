import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import { EntryList } from '@/features/pc/entries/components/entry-list';
import jaMessages from '@/i18n/messages/ja.json';

/**
 * Issue #362: データ取得待ちの間、空白ではなくスケルトンを描画することを検証。
 * authLoading 中（api 未確定）は一覧スケルトンが出て、空状態メッセージは出ない。
 */
describe('EntryList skeleton (Issue #362)', () => {
  afterEach(() => cleanup());

  function setup(authLoading: boolean, questionsLoading = false) {
    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <EntryList
          api={null}
          authLoading={authLoading}
          availableQuestions={[]}
          questionsLoading={questionsLoading}
        />
      </NextIntlClientProvider>,
    );
  }

  it('authLoading 中はスケルトンを描画する（空白にしない）', () => {
    setup(true);
    expect(screen.queryByTestId('entry-list-skeleton')).not.toBeNull();
  });

  it('authLoading 中は「エントリがありません」等の空状態メッセージを出さない', () => {
    setup(true);
    expect(screen.queryByText(jaMessages.entries.list.no_entries)).toBeNull();
  });
  it('問いの取得中はフィルタ行の枠で場所を取る（届いた瞬間に一覧がズレない）', () => {
    // 「取得中」と「問い0件」を区別できないと、枠 → 消える → 出る で2回ズレる。
    setup(false, true);
    expect(document.querySelector('[data-skeleton-slot="filter"]')).not.toBeNull();
  });

  it('問いが0件と確定したらフィルタ行の枠は出さない', () => {
    setup(false, false);
    expect(document.querySelector('[data-skeleton-slot="filter"]')).toBeNull();
  });
});
