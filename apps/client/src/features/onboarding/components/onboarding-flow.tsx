'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useState } from 'react';
import '../styles/onboarding.css';
import type { OnboardingResult } from '../types';
import { StepConcept, StepEditor, StepFerment, StepQuestion } from './steps';

interface OnboardingFlowProps {
  onComplete: (result: OnboardingResult) => void;
  initialStep?: number;
}

export function OnboardingFlow({ onComplete, initialStep = 0 }: OnboardingFlowProps) {
  const t = useTranslations('onboarding');
  const [step, setStep] = useState(initialStep);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(true);

  // Issue #305: スキップ不可。必ず最初の「問い」を立ててから complete に進む。
  const finish = useCallback(() => {
    setOpen(false);
    onComplete({ firstQuestion: draft.trim() || null });
  }, [draft, onComplete]);

  if (!open) return null;

  return (
    <div className="ob-stage" role="dialog" aria-modal="true" aria-label={t('dialog_label')}>
      <div className="ob-card" key={step}>
        {step === 0 && <StepConcept onNext={() => setStep(1)} />}
        {step === 1 && <StepQuestion draft={draft} setDraft={setDraft} onNext={() => setStep(2)} />}
        {step === 2 && <StepEditor onNext={() => setStep(3)} />}
        {step === 3 && <StepFerment draft={draft} onDone={finish} />}
      </div>
    </div>
  );
}
