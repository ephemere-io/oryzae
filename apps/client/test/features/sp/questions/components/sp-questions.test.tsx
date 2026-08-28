import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SpQuestions } from '@/features/sp/questions/components/sp-questions';
import jaMessages from '@/i18n/messages/ja.json';

function q(id: string, currentText: string, extra: Record<string, boolean> = {}) {
  return {
    id,
    currentText,
    isArchived: false,
    isProposedByOryzae: false,
    isValidatedByUser: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...extra,
  };
}

function renderQ(over: Record<string, unknown> = {}) {
  const props = {
    questions: [q('q1', 'なぜ書くのか')],
    loading: false,
    createQuestion: vi.fn(),
    editQuestion: vi.fn(),
    archiveQuestion: vi.fn(),
    acceptQuestion: vi.fn(),
    rejectQuestion: vi.fn(),
    ...over,
  };
  render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <SpQuestions {...props} />
    </NextIntlClientProvider>,
  );
  return props;
}

describe('SpQuestions', () => {
  afterEach(cleanup);

  it('問いの一覧を表示する', () => {
    renderQ();
    expect(screen.getByText('なぜ書くのか')).toBeTruthy();
  });

  it('手紙が届いた問いに印を出す（Issue #452）', () => {
    renderQ({ unreadQuestionIds: new Set(['q1']) });
    expect(screen.getByText(jaMessages.sp.questions.letter_arrived)).toBeTruthy();
  });

  it('手紙が届いていない問いには印を出さない', () => {
    renderQ({ unreadQuestionIds: new Set(['other']) });
    expect(screen.queryByText(jaMessages.sp.questions.letter_arrived)).toBeNull();
  });

  it('「新しい問いを立てる」でシートが開き、作成できる', () => {
    const props = renderQ();
    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.questions.add }));
    fireEvent.change(screen.getByPlaceholderText(jaMessages.sp.questions.placeholder), {
      target: { value: '新しい問い' },
    });
    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.questions.save }));
    expect(props.createQuestion).toHaveBeenCalledWith('新しい問い');
  });

  it('Oryzae の提案に受け入れ/見送りが出る', () => {
    const props = renderQ({
      questions: [q('p1', '提案の問い', { isProposedByOryzae: true, isValidatedByUser: false })],
    });
    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.questions.accept }));
    expect(props.acceptQuestion).toHaveBeenCalledWith('p1');
  });

  it('問いをタップ→終える（アーカイブ）できる', () => {
    const props = renderQ();
    fireEvent.click(screen.getByText('なぜ書くのか'));
    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.questions.delete }));
    expect(props.archiveQuestion).toHaveBeenCalledWith('q1');
  });
});
