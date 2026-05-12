import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnboardingFlow } from '@/features/onboarding/components/onboarding-flow';
import jaMessages from '@/i18n/messages/ja.json';

function renderFlow(onComplete: ReturnType<typeof vi.fn>, initialStep = 0) {
  render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <OnboardingFlow onComplete={onComplete} initialStep={initialStep} />
    </NextIntlClientProvider>,
  );
}

describe('OnboardingFlow', () => {
  afterEach(() => {
    cleanup();
  });

  it('スキップボタンを全ステップで描画しない (Issue #305)', () => {
    for (const step of [0, 1, 2, 3]) {
      renderFlow(vi.fn(), step);
      expect(screen.queryByRole('button', { name: jaMessages.onboarding.skip })).toBeNull();
      cleanup();
    }
  });

  it('最初の問いを入力するまでステップ2に進めない', () => {
    renderFlow(vi.fn(), 1);
    const nextBtn = screen.getByRole('button', {
      name: jaMessages.onboarding.step_question.next,
    });
    if (!(nextBtn instanceof HTMLButtonElement)) {
      throw new Error('next button should be a button element');
    }
    expect(nextBtn.disabled).toBe(true);
  });

  it('入力済みなら最終ステップから onComplete が firstQuestion 付きで呼ばれる', () => {
    const onComplete = vi.fn();
    renderFlow(onComplete, 1);

    const input = screen.getByPlaceholderText(jaMessages.onboarding.step_question.placeholder);
    fireEvent.change(input, { target: { value: 'なぜ?' } });
    fireEvent.click(screen.getByRole('button', { name: jaMessages.onboarding.step_question.next }));
    fireEvent.click(screen.getByRole('button', { name: jaMessages.onboarding.step_editor.next }));
    fireEvent.click(screen.getByRole('button', { name: jaMessages.onboarding.step_ferment.next }));

    expect(onComplete).toHaveBeenCalledWith({ firstQuestion: 'なぜ?' });
  });
});
