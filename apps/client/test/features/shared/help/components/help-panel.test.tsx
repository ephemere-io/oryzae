import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HelpPanel, type HelpPanelProps } from '@/features/shared/help/components/help-panel';
import { helpTextsFrom } from '@/features/shared/help/hooks/use-help-texts';
import { HELP_TOPICS } from '@/features/shared/help/topics';
import jaMessages from '@/i18n/messages/ja.json';

const TEXTS = helpTextsFrom((key) => {
  const [id, field] = key.split('.');
  const topics: Record<string, Record<string, string>> = jaMessages.help.topics;
  return topics[id ?? '']?.[field ?? ''] ?? key;
});

const CARD = '[data-verify-unit="HelpTopicCard"]';
const LIVE = '[data-verify-unit="HelpLiveCard"]';

function renderPanel(overrides: Partial<HelpPanelProps> = {}) {
  const props: HelpPanelProps = {
    texts: TEXTS,
    hovered: null,
    screenTopic: 'concept',
    focused: null,
    onFocus: vi.fn(),
    query: '',
    onQueryChange: vi.fn(),
    matches: [],
    remote: 'idle',
    onClose: vi.fn(),
    onOpenHref: vi.fn(),
    ...overrides,
  };
  render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <HelpPanel {...props} />
    </NextIntlClientProvider>,
  );
  return props;
}

function rowOf(topic: string): Element {
  const row = document.querySelector(`${CARD}[data-verify-topic="${topic}"] button[aria-expanded]`);
  if (!row) throw new Error(`${topic} の行が無い`);
  return row;
}

afterEach(() => {
  cleanup();
});

describe('HelpPanel', () => {
  it('一覧では全話題が並び、節の見出しも面の名前も無い', () => {
    renderPanel();
    expect(document.querySelectorAll(CARD)).toHaveLength(HELP_TOPICS.length);
    const text = document.body.textContent ?? '';
    for (const word of ['はじめに', '書斎のもの', '困ったとき', 'いま開いている', 'ようこそ']) {
      expect(text, word).not.toContain(word);
    }
  });

  it('頭の 1 枚は、何にも触れていなければ画面の話題、触れていればそれ', () => {
    renderPanel({ screenTopic: 'board' });
    expect(document.querySelector(LIVE)?.getAttribute('data-verify-topic')).toBe('board');
    expect(document.querySelector(LIVE)?.getAttribute('data-verify-following')).toBe('false');
    cleanup();

    renderPanel({ hovered: 'jar' });
    expect(document.querySelector(LIVE)?.getAttribute('data-verify-topic')).toBe('jar');
    expect(document.querySelector(LIVE)?.getAttribute('data-verify-following')).toBe('true');
    expect(screen.getByText(jaMessages.help.topics.jar.body)).toBeTruthy();
  });

  it('頭の 1 枚には押すものが無い（向かう途中で中身が変わり、押せないから）', () => {
    renderPanel({ hovered: 'support' });
    expect(document.querySelector(LIVE)?.querySelector('button, a')).toBeNull();
  });

  it('話題の行を押すと onFocus にその話題が渡り、もう一度押すと null', () => {
    const { onFocus } = renderPanel({ focused: null });
    fireEvent.click(rowOf('jar'));
    expect(onFocus).toHaveBeenCalledWith('jar');
    cleanup();

    const again = renderPanel({ focused: 'jar' });
    fireEvent.click(rowOf('jar'));
    expect(again.onFocus).toHaveBeenCalledWith(null);
  });

  it('開いた行の「開く」で行き先が渡る（外へ出る話題は external）', () => {
    const { onOpenHref } = renderPanel({ focused: 'support' });
    const open = screen.getByRole('button', { name: new RegExp(`^${jaMessages.help.open_topic}`) });
    fireEvent.click(open);
    expect(onOpenHref).toHaveBeenCalledWith('/support', true);
  });

  it('検索欄に書くと onQueryChange、消すボタンで空に', () => {
    const { onQueryChange } = renderPanel({ query: '手紙' });
    const input = screen.getByPlaceholderText(jaMessages.help.search_placeholder);
    fireEvent.change(input, { target: { value: '手紙は' } });
    expect(onQueryChange).toHaveBeenCalledWith('手紙は');
    fireEvent.click(screen.getByRole('button', { name: jaMessages.help.search_clear }));
    expect(onQueryChange).toHaveBeenCalledWith('');
  });

  it('検索中は近い話題だけ。頭の 1 枚は消え、1 件目は開いていて、Jev の 1 件には印', () => {
    renderPanel({
      query: '手紙',
      matches: [
        { id: 'letter', score: Number.POSITIVE_INFINITY, source: 'jev' },
        { id: 'pickle', score: 4, source: 'local' },
      ],
    });
    expect(document.querySelector(LIVE)).toBeNull();
    const cards = document.querySelectorAll(CARD);
    expect(cards).toHaveLength(2);
    expect(cards[0]?.getAttribute('data-verify-expanded')).toBe('true');
    expect(cards[0]?.getAttribute('data-verify-badge')).toBe(jaMessages.help.pick_badge);
    expect(cards[1]?.getAttribute('data-verify-expanded')).toBe('false');
    expect(screen.getByText(jaMessages.help.topics.letter.body)).toBeTruthy();
  });

  it('検索の結果は上位 6 件まで（薄く当たった話題で一覧が埋まらない）', () => {
    const many = HELP_TOPICS.map((topic, index) => ({
      id: topic.id,
      score: 20 - index,
      source: 'local' as const,
    }));
    renderPanel({ query: '書く', matches: many });
    expect(document.querySelectorAll(CARD)).toHaveLength(6);
    expect(
      document
        .querySelector('[data-verify-unit="HelpPanel"]')
        ?.getAttribute('data-verify-result-count'),
    ).toBe('6');
  });

  it('近い話題が無ければそう言う。訊いている最中ならそう言う', () => {
    renderPanel({ query: 'xyz', matches: [] });
    expect(screen.getByText(jaMessages.help.search_empty)).toBeTruthy();
    cleanup();
    renderPanel({ query: 'xyz', matches: [], remote: 'asking' });
    expect(screen.getByText(jaMessages.help.search_asking)).toBeTruthy();
  });

  it('閉じるで onClose', () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: jaMessages.help.close }));
    expect(onClose).toHaveBeenCalled();
  });
});
