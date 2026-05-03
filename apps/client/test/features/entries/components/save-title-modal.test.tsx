import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaveTitleModal } from '@/features/entries/components/save-title-modal';

describe('SaveTitleModal', () => {
  function setup() {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <SaveTitleModal
        open
        initialTitle="default-title"
        saving={false}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    return { onSave, onClose };
  }

  it('Enter キーで送信される（通常入力時）', () => {
    const { onSave } = setup();
    const input = screen.getByLabelText('タイトル') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter', isComposing: false });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(onSave).toHaveBeenCalledWith('hello');
  });

  it('IME 変換確定の Enter（isComposing=true）では送信されない', () => {
    const { onSave } = setup();
    const input = screen.getByLabelText('タイトル') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'にほんご' } });
    // isComposing=true の Enter は preventDefault され、フォーム submit が走らない
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    expect(onSave).not.toHaveBeenCalled();
  });
});
