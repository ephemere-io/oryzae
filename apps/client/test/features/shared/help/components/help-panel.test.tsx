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
    firstVisit: false,
    shortcutHint: true,
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

afterEach(() => {
  cleanup();
});

describe('HelpPanel', () => {
  it('一覧では 4 つの節と全話題が並ぶ', () => {
    renderPanel();
    for (const heading of Object.values(jaMessages.help.section)) {
      expect(screen.getByText(heading)).toBeTruthy();
    }
    expect(document.querySelectorAll('[data-verify-unit="HelpTopicCard"]')).toHaveLength(
      HELP_TOPICS.length + 1,
    );
  });

  it('何にも触れていなければ「いま開いている画面」、触れていれば「いま触れているもの」', () => {
    renderPanel({ screenTopic: 'board' });
    expect(screen.getByText(jaMessages.help.here_title)).toBeTruthy();
    expect(
      document.querySelector('[data-verify-spot="true"]')?.getAttribute('data-verify-topic'),
    ).toBe('board');
    cleanup();

    renderPanel({ hovered: 'jar' });
    expect(screen.getByText(jaMessages.help.hover_title)).toBeTruthy();
    expect(
      document.querySelector('[data-verify-spot="true"]')?.getAttribute('data-verify-topic'),
    ).toBe('jar');
  });

  it('話題の行を押すと onFocus にその話題が渡り、もう一度押すと null', () => {
    const rowOf = (topic: string) => {
      const row = document.querySelector(`[data-verify-topic="${topic}"] button[aria-expanded]`);
      if (!row) throw new Error(`${topic} の行が無い`);
      return row;
    };
    const { onFocus } = renderPanel({ focused: null });
    fireEvent.click(rowOf('jar'));
    expect(onFocus).toHaveBeenCalledWith('jar');
    cleanup();

    const again = renderPanel({ focused: 'jar' });
    fireEvent.click(rowOf('jar'));
    expect(again.onFocus).toHaveBeenCalledWith(null);
  });

  it('開いた話題の「開く」で行き先が渡る（外へ出る話題は external）', () => {
    const { onOpenHref } = renderPanel({ focused: 'support' });
    const open = screen
      .getAllByRole('button', { name: new RegExp(`^${jaMessages.help.open_topic}`) })
      .at(-1);
    if (!open) throw new Error('開く が無い');
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

  it('検索中は近い話題だけ。1 件目は開いていて、Jev の 1 件には印', () => {
    renderPanel({
      query: '手紙',
      matches: [
        { id: 'letter', score: Number.POSITIVE_INFINITY, source: 'jev' },
        { id: 'pickle', score: 4, source: 'local' },
      ],
    });
    const cards = document.querySelectorAll('[data-verify-unit="HelpTopicCard"]');
    expect(cards).toHaveLength(2);
    expect(cards[0]?.getAttribute('data-verify-expanded')).toBe('true');
    expect(cards[0]?.getAttribute('data-verify-badge')).toBe(jaMessages.help.pick_badge);
    expect(cards[1]?.getAttribute('data-verify-expanded')).toBe('false');
    expect(screen.getByText(jaMessages.help.topics.letter.body)).toBeTruthy();
  });

  it('近い話題が無ければそう言う。訊いている最中ならそう言う', () => {
    renderPanel({ query: 'xyz', matches: [] });
    expect(screen.getByText(jaMessages.help.search_empty)).toBeTruthy();
    cleanup();
    renderPanel({ query: 'xyz', matches: [], remote: 'asking' });
    expect(screen.getByText(jaMessages.help.search_asking)).toBeTruthy();
  });

  it('初めての人には「ようこそ」', () => {
    renderPanel({ firstVisit: true });
    expect(screen.getByText(jaMessages.help.welcome_title)).toBeTruthy();
  });

  it('閉じるで onClose', () => {
    const { onClose } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: jaMessages.help.close }));
    expect(onClose).toHaveBeenCalled();
  });
});
