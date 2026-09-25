import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HelpScreenCard, TEXT_SETTLE_MS } from '@/features/shared/help/components/help-screen-card';
import { helpTextsFrom } from '@/features/shared/help/hooks/use-help-texts';
import { helpTopic, screenParts } from '@/features/shared/help/topics';
import type { HelpTopicId, HelpTopicText } from '@/features/shared/help/types';
import jaMessages from '@/i18n/messages/ja.json';

const TEXTS = new Map<HelpTopicId, HelpTopicText>(
  helpTextsFrom((key) => {
    const [id, field] = key.split('.');
    const topics: Record<string, Record<string, string>> = jaMessages.help.topics;
    return topics[id ?? '']?.[field ?? ''] ?? key;
  }).map((text) => [text.id, text]),
);

function card(screen: HelpTopicId, hovered: HelpTopicId | null) {
  return (
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <HelpScreenCard
        screen={helpTopic(screen)}
        parts={screenParts(screen).map(helpTopic)}
        texts={TEXTS}
        hovered={hovered}
      />
    </NextIntlClientProvider>
  );
}

const SCREEN = '[data-verify-unit="HelpScreenCard"]';
const attr = (name: string) => document.querySelector(SCREEN)?.getAttribute(name);

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('HelpScreenCard', () => {
  it('画面の中で触れた物は、図がすぐ灯り、説明文は少し止まってから差し替わる', () => {
    vi.useFakeTimers();
    const view = render(card('study', null));
    view.rerender(card('study', 'jar'));
    expect(attr('data-verify-active')).toBe('jar');
    expect(document.querySelector('[data-part="jar"]')?.hasAttribute('data-lit')).toBe(true);
    expect(attr('data-verify-explains')).toBe('none');

    // 物をまたいだだけなら文は動かない。
    act(() => {
      vi.advanceTimersByTime(TEXT_SETTLE_MS / 2);
    });
    view.rerender(card('study', 'notebook'));
    act(() => {
      vi.advanceTimersByTime(TEXT_SETTLE_MS / 2);
    });
    expect(attr('data-verify-explains')).toBe('none');

    act(() => {
      vi.advanceTimersByTime(TEXT_SETTLE_MS);
    });
    expect(attr('data-verify-explains')).toBe('notebook');
    expect(document.querySelector(SCREEN)?.textContent).toContain(
      jaMessages.help.topics.notebook.body,
    );
  });

  it('面の中の図に触れたときは待たない（本人がそこを見ている）', () => {
    vi.useFakeTimers();
    render(card('study', null));
    const archive = document.querySelector('[data-part="archive"]');
    if (!archive) throw new Error('棚が無い');
    fireEvent.pointerEnter(archive);
    expect(attr('data-verify-explains')).toBe('archive');
  });

  it('ボードの見取り図には写真が居て、画面の写真に触れると灯る', () => {
    render(card('board', 'photo'));
    const photo = document.querySelector('[data-part="photo"]');
    expect(photo?.querySelector('text')?.textContent).toBe(jaMessages.help.map.board.photo);
    expect(photo?.hasAttribute('data-lit')).toBe(true);
    expect(document.querySelector(SCREEN)?.textContent).toContain(
      jaMessages.help.topics.photo.body,
    );
  });
});
