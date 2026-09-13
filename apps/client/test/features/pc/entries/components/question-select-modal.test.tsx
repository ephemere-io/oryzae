import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionSelectModal } from '@/features/pc/entries/components/question-select-modal';
import jaMessages from '@/i18n/messages/ja.json';
import { closestOrThrow } from '../../../../helpers/dom';

describe('QuestionSelectModal (Issue #316 → SP と同じ選び手)', () => {
  afterEach(() => cleanup());

  function setup(
    args: {
      open?: boolean;
      saving?: boolean;
      activeQuestions?: { id: string; currentText: string | null }[];
      linkedQuestionIds?: Set<string>;
      onCreate?: (text: string) => Promise<string | null>;
    } = {},
  ) {
    const onToggle = vi.fn();
    const onCreate = args.onCreate ?? vi.fn(async () => 'q-new');
    const onProceed = vi.fn();
    const onClose = vi.fn();
    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <QuestionSelectModal
          open={args.open ?? true}
          saving={args.saving ?? false}
          activeQuestions={
            args.activeQuestions ?? [
              { id: 'q1', currentText: '今日の小さな発見は？' },
              { id: 'q2', currentText: '何にときめいた？' },
            ]
          }
          linkedQuestionIds={args.linkedQuestionIds ?? new Set()}
          onToggle={onToggle}
          onCreate={onCreate}
          onProceed={onProceed}
          onClose={onClose}
        />
      </NextIntlClientProvider>,
    );
    return { onToggle, onCreate, onProceed, onClose };
  }

  it('open=false なら描画しない', () => {
    setup({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('問いが行で並び、押すと onToggle(id) を呼ぶ（閉じない＝続けて複数選べる）', () => {
    const { onToggle, onClose } = setup();
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(screen.getByText('何にときめいた？'));
    expect(onToggle).toHaveBeenCalledWith('q2');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('結んでいる問いは一覧から消えず、印（aria-pressed）が付く', () => {
    setup({ linkedQuestionIds: new Set(['q1']) });
    const linked = closestOrThrow(screen.getByText('今日の小さな発見は？'), 'button');
    const other = closestOrThrow(screen.getByText('何にときめいた？'), 'button');
    expect(linked.getAttribute('aria-pressed')).toBe('true');
    expect(other.getAttribute('aria-pressed')).toBe('false');
  });

  it('結んだ問いが無ければ「紐付けて漬け込む」は押せない', () => {
    const { onProceed } = setup();
    const button = closestOrThrow(screen.getByText('紐付けて漬け込む'), 'button');
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onProceed).not.toHaveBeenCalled();
  });

  it('1 つ以上結んでいれば「紐付けて漬け込む」で onProceed を呼ぶ', () => {
    const { onProceed } = setup({ linkedQuestionIds: new Set(['q2']) });
    const button = closestOrThrow(screen.getByText('紐付けて漬け込む'), 'button');
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onProceed).toHaveBeenCalledTimes(1);
  });

  it('saving 中は結んでいても押せない', () => {
    setup({ saving: true, linkedQuestionIds: new Set(['q2']) });
    const button = closestOrThrow(screen.getByText('漬け込み中...'), 'button');
    expect(button.disabled).toBe(true);
  });

  it('問いが 1 つも無ければ書く欄で始まり、書いて作ると onCreate(text) を呼ぶ', async () => {
    const onCreate = vi.fn(async () => 'q-new');
    setup({ activeQuestions: [], onCreate });
    const input = screen.getByPlaceholderText<HTMLInputElement>(/問いを書く/);
    fireEvent.change(input, { target: { value: '今日の感謝は？' } });
    fireEvent.click(screen.getByText('この問いにする'));
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith('今日の感謝は？'));
  });

  it('問いがあっても「新しく問いを書く」で書く欄に切り替わる', () => {
    setup();
    fireEvent.click(screen.getByText('+ 新しく問いを書く'));
    expect(screen.getByPlaceholderText(/問いを書く/)).toBeTruthy();
  });

  it('「キャンセル」で onClose を呼ぶ', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByText('キャンセル'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
