import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionPicker } from '@/features/shared/entry-questions/components/question-picker';
import jaMessages from '@/i18n/messages/ja.json';

function renderPicker(count: number) {
  const questions = Array.from({ length: count }, (_, i) => ({
    id: `q${i}`,
    currentText: `問い ${i}`,
  }));
  render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <QuestionPicker
        questions={questions}
        selectedIds={[]}
        onToggle={vi.fn()}
        onCreate={vi.fn(async () => null)}
        composing={false}
        onComposingChange={vi.fn()}
      />
    </NextIntlClientProvider>,
  );
}

describe('QuestionPicker（問いの上限、#430）', () => {
  afterEach(cleanup);

  it('上限（5）なら「新しく問いを書く」を出さない。説明の文も置かない', () => {
    renderPicker(5);
    expect(screen.queryByText(jaMessages.entry_questions.picker.new)).toBeNull();
    expect(document.querySelector('[data-question-limit]')).toBeNull();
  });

  it('上限未満なら「新しく問いを書く」を出す', () => {
    renderPicker(4);
    expect(screen.getByText(jaMessages.entry_questions.picker.new)).toBeTruthy();
  });
});
