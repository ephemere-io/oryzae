'use client';

import { useTranslations } from 'next-intl';
import { ConceptIllo, EditorIllo, JarIllo, QuestionIllo } from './illustrations';

interface FooterBarProps {
  step: number;
  onNext: () => void;
  onSkip: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
  finishing?: boolean;
}

function FooterBar({ step, onNext, onSkip, nextLabel, nextDisabled, finishing }: FooterBarProps) {
  const t = useTranslations('onboarding');
  return (
    <div className="ob-footer">
      <div
        className="ob-progress"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={4}
        aria-valuenow={step + 1}
        aria-label={`step ${step + 1} of 4`}
      >
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`ob-progress-dot ${i === step ? 'is-active' : i < step ? 'is-done' : ''}`}
          />
        ))}
      </div>
      <div className="ob-footer-actions">
        {!finishing && (
          <button type="button" className="ob-btn" onClick={onSkip}>
            {t('skip')}
          </button>
        )}
        <button
          type="button"
          className="ob-btn ob-btn-primary"
          onClick={onNext}
          disabled={nextDisabled}
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

interface StepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function StepConcept({ onNext, onSkip }: StepProps) {
  const t = useTranslations('onboarding.step_concept');
  return (
    <>
      <div className="ob-card-inner">
        <div className="ob-illo-wrap">
          <ConceptIllo />
        </div>
        <div className="ob-eyebrow">{t('eyebrow')}</div>
        <h1 className="ob-title">
          {t('title_l1')}
          <br />
          {t('title_l2')}
        </h1>
        <p className="ob-body">
          {t('body')}
          <br />
          {t('body_2')}
        </p>
      </div>
      <FooterBar step={0} onNext={onNext} onSkip={onSkip} nextLabel={t('next')} />
    </>
  );
}

interface StepQuestionProps extends StepProps {
  draft: string;
  setDraft: (value: string) => void;
}

export function StepQuestion({ onNext, onSkip, draft, setDraft }: StepQuestionProps) {
  const t = useTranslations('onboarding.step_question');
  const valid = draft.trim().length > 0 && draft.trim().length <= 64;
  return (
    <>
      <div className="ob-card-inner">
        <div className="ob-illo-wrap">
          <QuestionIllo />
        </div>
        <div className="ob-eyebrow">{t('eyebrow')}</div>
        <h1 className="ob-title">{t('title')}</h1>
        <p className="ob-body">{t('body')}</p>
        <div className="ob-input-row">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('placeholder')}
            maxLength={64}
            className="ob-input"
            // biome-ignore lint/a11y/noAutofocus: onboarding modal expects immediate focus on the input
            autoFocus
          />
          <span className="ob-input-count">{draft.length}/64</span>
        </div>
        <p className="ob-hint">{t('hint')}</p>
      </div>
      <FooterBar
        step={1}
        onNext={() => valid && onNext()}
        onSkip={onSkip}
        nextLabel={t('next')}
        nextDisabled={!valid}
      />
    </>
  );
}

export function StepEditor({ onNext, onSkip }: StepProps) {
  const t = useTranslations('onboarding.step_editor');
  return (
    <>
      <div className="ob-card-inner">
        <div className="ob-illo-wrap">
          <EditorIllo />
        </div>
        <div className="ob-eyebrow">{t('eyebrow')}</div>
        <h1 className="ob-title">
          {t('title_l1')}
          <br />
          {t('title_l2')}
        </h1>
        <p className="ob-body">
          {t('body_before_em')}
          <em className="ob-em">{t('body_em')}</em>
          {t('body_after_em')}
        </p>
        <ul className="ob-list">
          <li>
            <span className="ob-list-dot" style={{ background: '#8EA89C' }} />
            {t('list_autosave')}
          </li>
          <li>
            <span className="ob-list-dot" style={{ background: '#9C9658' }} />
            {t('list_snippet')}
          </li>
          <li>
            <span className="ob-list-dot" style={{ background: '#D4714E' }} />
            {t('list_link')}
          </li>
        </ul>
      </div>
      <FooterBar step={2} onNext={onNext} onSkip={onSkip} nextLabel={t('next')} />
    </>
  );
}

interface StepFermentProps {
  onDone: () => void;
  onSkip: () => void;
  draft: string;
}

export function StepFerment({ onDone, onSkip, draft }: StepFermentProps) {
  const t = useTranslations('onboarding.step_ferment');
  const trimmed = draft.trim();
  return (
    <>
      <div className="ob-card-inner">
        <div className="ob-illo-wrap">
          <JarIllo />
        </div>
        <div className="ob-eyebrow">{t('eyebrow')}</div>
        <h1 className="ob-title">{t('title')}</h1>
        <p className="ob-body">{t('body')}</p>
        {trimmed && (
          <div className="ob-recap">
            <span className="ob-recap-label">{t('recap_label')}</span>
            <span className="ob-recap-text">{t('recap_quote', { question: trimmed })}</span>
          </div>
        )}
      </div>
      <FooterBar step={3} onNext={onDone} onSkip={onSkip} nextLabel={t('next')} finishing />
    </>
  );
}
