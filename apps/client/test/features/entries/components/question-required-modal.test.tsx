import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuestionRequiredModal } from '@/features/entries/components/question-required-modal';
import jaMessages from '@/i18n/messages/ja.json';

const sampleQuestions = [
  { id: 'q1', currentText: 'なぜ今日は穏やかだったのか？' },
  { id: 'q2', currentText: '何に怒りを感じたのか？' },
];

function renderModal(overrides: Partial<React.ComponentProps<typeof QuestionRequiredModal>> = {}) {
  const props: React.ComponentProps<typeof QuestionRequiredModal> = {
    open: true,
    activeQuestions: sampleQuestions,
    onSelect: vi.fn(),
    onCreate: vi.fn().mockResolvedValue(undefined),
    dismissable: false,
    onDismiss: vi.fn(),
    variant: 'open',
    ...overrides,
  };
  render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <QuestionRequiredModal {...props} />
    </NextIntlClientProvider>,
  );
  return props;
}

describe('QuestionRequiredModal (Issue #314)', () => {
  afterEach(() => cleanup());

  it('open=false なら何も描画しない', () => {
    renderModal({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('既存の問いをラジオで選び submit すると onSelect が呼ばれる', () => {
    const onSelect = vi.fn();
    renderModal({ onSelect });
    fireEvent.click(screen.getByLabelText('なぜ今日は穏やかだったのか？'));
    fireEvent.click(
      screen.getByRole('button', { name: jaMessages.editor.question_required.submit }),
    );
    expect(onSelect).toHaveBeenCalledWith('q1');
  });

  it('問いがゼロ件のときは create モードで起動し submit すると onCreate が呼ばれる', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderModal({ activeQuestions: [], onCreate });
    const input = screen.getByLabelText(jaMessages.editor.question_required.create_label);
    fireEvent.change(input, { target: { value: 'こんにちは' } });
    fireEvent.click(
      screen.getByRole('button', { name: jaMessages.editor.question_required.submit }),
    );
    expect(onCreate).toHaveBeenCalledWith('こんにちは');
  });

  it('「新しく書く」タブに切り替えてインラインで問いを作成できる', async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    renderModal({ onCreate });
    fireEvent.click(
      screen.getByRole('button', { name: jaMessages.editor.question_required.tab_create }),
    );
    const input = screen.getByLabelText(jaMessages.editor.question_required.create_label);
    fireEvent.change(input, { target: { value: '新しい問い' } });
    fireEvent.click(
      screen.getByRole('button', { name: jaMessages.editor.question_required.submit }),
    );
    expect(onCreate).toHaveBeenCalledWith('新しい問い');
  });

  it('dismissable=false ではキャンセル/Escape で閉じない', () => {
    const onDismiss = vi.fn();
    renderModal({ dismissable: false, onDismiss });
    // No cancel button rendered
    expect(
      screen.queryByRole('button', { name: jaMessages.editor.question_required.cancel }),
    ).toBeNull();
    // Escape should be no-op
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('dismissable=true ならキャンセルボタンと Escape で onDismiss が呼ばれる', () => {
    const onDismiss = vi.fn();
    renderModal({ dismissable: true, onDismiss });
    fireEvent.click(
      screen.getByRole('button', { name: jaMessages.editor.question_required.cancel }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it('variant=save_attempt なら save_attempt 用の文言が表示される', () => {
    renderModal({ variant: 'save_attempt' });
    expect(screen.getByText(jaMessages.editor.question_required.body_save_attempt)).toBeTruthy();
  });

  it('未選択／空文字では submit ボタンが disabled', () => {
    renderModal();
    const submit = screen.getByRole('button', {
      name: jaMessages.editor.question_required.submit,
    });
    if (!(submit instanceof HTMLButtonElement)) throw new Error('expected button');
    expect(submit.disabled).toBe(true);
  });
});
