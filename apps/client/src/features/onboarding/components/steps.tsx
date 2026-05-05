'use client';

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
            スキップ
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
  return (
    <>
      <div className="ob-card-inner">
        <div className="ob-illo-wrap">
          <ConceptIllo />
        </div>
        <div className="ob-eyebrow">01 — Welcome</div>
        <h1 className="ob-title">
          Oryzaeは、
          <br />
          問いを育てるジャーナル。
        </h1>
        <p className="ob-body">
          頭に浮かんだ問いを蒔き、日々のエントリで水をやる。
          時間が経つと、AIが書き溜めたものを発酵させ、 新しい気づきとして返してくれる。
          <br />
          ふつうの日記とは少し違う、4つの場所を順に見てみましょう。
        </p>
      </div>
      <FooterBar step={0} onNext={onNext} onSkip={onSkip} nextLabel="はじめる" />
    </>
  );
}

interface StepQuestionProps extends StepProps {
  draft: string;
  setDraft: (value: string) => void;
}

export function StepQuestion({ onNext, onSkip, draft, setDraft }: StepQuestionProps) {
  const valid = draft.trim().length > 0 && draft.trim().length <= 64;
  return (
    <>
      <div className="ob-card-inner">
        <div className="ob-illo-wrap">
          <QuestionIllo />
        </div>
        <div className="ob-eyebrow">02 — Question</div>
        <h1 className="ob-title">最初の「問い」を蒔く。</h1>
        <p className="ob-body">
          あなたが今いちばん考えていることを、短い問いの形にしてみてください。
          「なぜ──」「どうすれば──」、答えのまだない一文で構いません。 後からいつでも編集できます。
        </p>
        <div className="ob-input-row">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="例: なぜ自分は急ぐのが苦手なのだろう"
            maxLength={64}
            className="ob-input"
            // biome-ignore lint/a11y/noAutofocus: onboarding modal expects immediate focus on the input
            autoFocus
          />
          <span className="ob-input-count">{draft.length}/64</span>
        </div>
        <p className="ob-hint">あとで Jar に保管され、ここから発酵が始まります。</p>
      </div>
      <FooterBar
        step={1}
        onNext={() => valid && onNext()}
        onSkip={onSkip}
        nextLabel="この問いで進む"
        nextDisabled={!valid}
      />
    </>
  );
}

export function StepEditor({ onNext, onSkip }: StepProps) {
  return (
    <>
      <div className="ob-card-inner">
        <div className="ob-illo-wrap">
          <EditorIllo />
        </div>
        <div className="ob-eyebrow">03 — Editor</div>
        <h1 className="ob-title">
          エントリを書きながら、
          <br />
          言葉を集める。
        </h1>
        <p className="ob-body">
          エディタは静かな書き場所です。普段思ったことをそのまま書いてください。 一文を選択すると{' '}
          <em className="ob-em">スニペット</em> として切り出せ、 後で Board に並べて見渡せます。
        </p>
        <ul className="ob-list">
          <li>
            <span className="ob-list-dot" style={{ background: '#8EA89C' }} />
            自動保存される
          </li>
          <li>
            <span className="ob-list-dot" style={{ background: '#9C9658' }} />
            選択でスニペット作成
          </li>
          <li>
            <span className="ob-list-dot" style={{ background: '#D4714E' }} />
            関連する問いに紐づけ
          </li>
        </ul>
      </div>
      <FooterBar step={2} onNext={onNext} onSkip={onSkip} nextLabel="次へ" />
    </>
  );
}

interface StepFermentProps {
  onDone: () => void;
  onSkip: () => void;
  draft: string;
}

export function StepFerment({ onDone, onSkip, draft }: StepFermentProps) {
  const trimmed = draft.trim();
  return (
    <>
      <div className="ob-card-inner">
        <div className="ob-illo-wrap">
          <JarIllo />
        </div>
        <div className="ob-eyebrow">04 — Jar &amp; Fermentation</div>
        <h1 className="ob-title">Jarで、問いをじっくり寝かせる。</h1>
        <p className="ob-body">
          書き溜めたエントリは Jar に蓄えられ、定期的に発酵されます。
          AIがあなたの言葉を読み返し、共通点や問いの変化を見つけて
          そっと差し出してくれる──それがOryzaeのリズムです。
        </p>
        {trimmed && (
          <div className="ob-recap">
            <span className="ob-recap-label">あなたの最初の問い</span>
            <span className="ob-recap-text">「{trimmed}」</span>
          </div>
        )}
      </div>
      <FooterBar step={3} onNext={onDone} onSkip={onSkip} nextLabel="Oryzaeをはじめる" finishing />
    </>
  );
}
