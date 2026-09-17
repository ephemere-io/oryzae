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

  it('問いをタップ→アーカイブは、確かめてからアーカイブする（1 回押しただけでは消えない）', () => {
    const props = renderQ();
    fireEvent.click(screen.getByText('なぜ書くのか'));
    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.questions.archive }));
    expect(props.archiveQuestion).not.toHaveBeenCalled();
    expect(screen.getByText(jaMessages.sp.questions.archive_confirm_title)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.questions.archive_confirm }));
    expect(props.archiveQuestion).toHaveBeenCalledWith('q1');
  });

  it('確かめで「やめる」を押せばアーカイブしない', () => {
    const props = renderQ();
    fireEvent.click(screen.getByText('なぜ書くのか'));
    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.questions.archive }));
    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.questions.archive_cancel }));
    expect(props.archiveQuestion).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: jaMessages.sp.questions.archive })).toBeTruthy();
  });

  it('アーカイブした問いは、開いて「戻す」で戻せる', () => {
    const unarchiveQuestion = vi.fn();
    renderQ({
      questions: [q('q1', 'なぜ書くのか'), q('a1', '去年の問い', { isArchived: true })],
      unarchiveQuestion,
    });
    expect(screen.queryByText('去年の問い')).toBeNull();
    fireEvent.click(
      screen.getByRole('button', {
        name: jaMessages.sp.questions.archived_section.replace('{count}', '1'),
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.questions.unarchive }));
    expect(unarchiveQuestion).toHaveBeenCalledWith('a1');
  });

  it('生きている問いが上限なら「戻す」は押せず、理由を出す', () => {
    renderQ({
      questions: [
        ...['q1', 'q2', 'q3', 'q4', 'q5'].map((id) => q(id, `問い ${id}`)),
        q('a1', '去年の問い', { isArchived: true }),
      ],
      unarchiveQuestion: vi.fn(),
    });
    fireEvent.click(
      screen.getByRole('button', {
        name: jaMessages.sp.questions.archived_section.replace('{count}', '1'),
      }),
    );
    const restore = screen.getByRole('button', { name: jaMessages.sp.questions.unarchive });
    expect(restore).toHaveProperty('disabled', true);
    expect(
      screen.getByText(jaMessages.sp.questions.unarchive_limit.replace('{max}', '5')),
    ).toBeTruthy();
  });

  it('戻す手段を渡されなければ、アーカイブした問いの一覧を出さない', () => {
    renderQ({ questions: [q('q1', 'なぜ書くのか'), q('a1', '去年の問い', { isArchived: true })] });
    expect(screen.queryByText(/アーカイブした問い/)).toBeNull();
  });

  it('生きている問いが上限（5）なら「立てる」を出さず、理由を出す（#430）', () => {
    renderQ({
      questions: ['q1', 'q2', 'q3', 'q4', 'q5'].map((id) => q(id, `問い ${id}`)),
    });
    expect(screen.queryByRole('button', { name: jaMessages.sp.questions.add })).toBeNull();
    expect(screen.getByText(jaMessages.sp.questions.limit.replace('{max}', '5'))).toBeTruthy();
  });

  it('4 つならまだ「立てる」を出す', () => {
    renderQ({ questions: ['q1', 'q2', 'q3', 'q4'].map((id) => q(id, `問い ${id}`)) });
    expect(screen.getByRole('button', { name: jaMessages.sp.questions.add })).toBeTruthy();
  });
});
