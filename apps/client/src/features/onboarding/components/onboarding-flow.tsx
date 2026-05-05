'use client';

import { useCallback, useState } from 'react';
import '../styles/onboarding.css';
import type { OnboardingResult } from '../types';
import { StepConcept, StepEditor, StepFerment, StepQuestion } from './steps';

interface OnboardingFlowProps {
  onComplete: (result: OnboardingResult) => void;
  initialStep?: number;
}

export function OnboardingFlow({ onComplete, initialStep = 0 }: OnboardingFlowProps) {
  const [step, setStep] = useState(initialStep);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(true);

  const finish = useCallback(
    (reason: 'complete' | 'skip') => {
      setOpen(false);
      onComplete({
        skipped: reason === 'skip',
        firstQuestion: draft.trim() || null,
      });
    },
    [draft, onComplete],
  );

  if (!open) return null;

  return (
    <div className="ob-stage" role="dialog" aria-modal="true" aria-label="Oryzaeの紹介">
      <div className="ob-card" key={step}>
        {step === 0 && <StepConcept onNext={() => setStep(1)} onSkip={() => finish('skip')} />}
        {step === 1 && (
          <StepQuestion
            draft={draft}
            setDraft={setDraft}
            onNext={() => setStep(2)}
            onSkip={() => finish('skip')}
          />
        )}
        {step === 2 && <StepEditor onNext={() => setStep(3)} onSkip={() => finish('skip')} />}
        {step === 3 && (
          <StepFerment
            draft={draft}
            onDone={() => finish('complete')}
            onSkip={() => finish('skip')}
          />
        )}
      </div>
    </div>
  );
}
