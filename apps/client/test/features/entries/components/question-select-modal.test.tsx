import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionSelectModal } from '@/features/entries/components/question-select-modal';
import jaMessages from '@/i18n/messages/ja.json';

describe('QuestionSelectModal (Issue #316)', () => {
  afterEach(() => cleanup());

  function setup(
    args: {
      open?: boolean;
      activeQuestions?: { id: string; currentText: string | null }[];
      linkedQuestionIds?: Set<string>;
    } = {},
  ) {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <QuestionSelectModal
          open={args.open ?? true}
          saving={false}
          activeQuestions={
            args.activeQuestions ?? [
              { id: 'q1', currentText: '今日の小さな発見は？' },
              { id: 'q2', currentText: '何にときめいた？' },
            ]
          }
          linkedQuestionIds={args.linkedQuestionIds ?? new Set()}
          onConfirm={onConfirm}
          onClose={onClose}
        />
      </NextIntlClientProvider>,
    );
    return { onConfirm, onClose };
  }

  it('open=false なら描画しない', () => {
    setup({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('既存の問いがあれば pick モードがデフォルトで、selectで選択して確定すると existingId を渡す', () => {
    const { onConfirm } = setup();
    expect(screen.getByRole('dialog')).toBeTruthy();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'q2' } });
    fireEvent.click(screen.getByText('紐付けて漬け込む'));
    expect(onConfirm).toHaveBeenCalledWith({ existingId: 'q2', newQuestionText: null });
  });

  it('既存の問いが 1 つもなければ create モードで開き、入力して確定すると newQuestionText を渡す', () => {
    const { onConfirm } = setup({ activeQuestions: [] });
    const input = screen.getByPlaceholderText(/問いを書く/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '今日の感謝は？' } });
    fireEvent.click(screen.getByText('紐付けて漬け込む'));
    expect(onConfirm).toHaveBeenCalledWith({
      existingId: null,
      newQuestionText: '今日の感謝は？',
    });
  });

  it('mode_create に切り替えると新規入力欄に切り替わる', () => {
    setup();
    fireEvent.click(screen.getByLabelText('新しく書く'));
    expect(screen.getByPlaceholderText(/問いを書く/)).toBeTruthy();
  });

  it('既に紐付いている問いは選択肢から除外される', () => {
    setup({ linkedQuestionIds: new Set(['q1']) });
    expect(screen.queryByText('今日の小さな発見は？')).toBeNull();
    expect(screen.getByText('何にときめいた？')).toBeTruthy();
  });

  it('未選択 / 未入力のまま確定はできない (ボタン disabled)', () => {
    const { onConfirm } = setup();
    const button = screen.getByText('紐付けて漬け込む').closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('「キャンセル」で onClose を呼ぶ', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByText('キャンセル'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
