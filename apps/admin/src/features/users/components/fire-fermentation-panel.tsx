'use client';

import { Flame } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useFireFermentation } from '../hooks/use-fire-fermentation';

// issue #290: 特定ユーザー / 問いに対する発酵強制発火 (admin デバッグ用)。
// 条件ゲートをバイパスするため、本番ユーザーへの誤実行を防ぐ「2 段階クリック」を採用。

interface Props {
  userId: string;
  // active questions のみ。空配列のときはパネル全体を非表示にする。
  questions: Array<{ id: string; text: string }>;
  // 発火後にユーザー詳細をリフレッシュさせるためのコールバック (任意)。
  onCompleted?: () => void;
}

type LanguageChoice = 'auto' | 'ja' | 'en';

export function FireFermentationPanel({ userId, questions, onCompleted }: Props) {
  const [questionId, setQuestionId] = useState<string>(''); // '' = 全 active 問い
  const [language, setLanguage] = useState<LanguageChoice>('auto');
  const [skipEmail, setSkipEmail] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { fire, loading, error, result, reset } = useFireFermentation();

  if (questions.length === 0) {
    return null;
  }

  const handleRun = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    const ok = await fire({
      userId,
      questionId: questionId || undefined,
      language: language === 'auto' ? undefined : language,
      skipEmail: skipEmail || undefined,
    });
    if (ok) onCompleted?.();
  };

  const handleChange = () => {
    // 入力を変えたら確認状態をリセット
    setConfirming(false);
    if (error || result) reset();
  };

  return (
    <div className="space-y-3 rounded-md border border-border/40 bg-card px-3 py-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          発酵を強制発火 (デバッグ用)
        </h4>
        <span className="text-[10px] text-muted-foreground">条件ゲートをバイパス</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">問い</span>
          <select
            value={questionId}
            onChange={(e) => {
              setQuestionId(e.target.value);
              handleChange();
            }}
            disabled={loading}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          >
            <option value="">全 active 問い ({questions.length} 件)</option>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.text.length > 60 ? `${q.text.slice(0, 60)}…` : q.text}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted-foreground">言語</span>
          <select
            value={language}
            onChange={(e) => {
              const next = e.target.value;
              if (next === 'auto' || next === 'ja' || next === 'en') {
                setLanguage(next);
                handleChange();
              }
            }}
            disabled={loading}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          >
            <option value="auto">自動 (ユーザーの user_metadata.locale)</option>
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>

      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={skipEmail}
          onChange={(e) => {
            setSkipEmail(e.target.checked);
            handleChange();
          }}
          disabled={loading}
          className="h-3.5 w-3.5 rounded border-input"
        />
        <span>メール送信をスキップ (LLM 出力だけ確認したいとき)</span>
      </label>

      <Button
        variant={confirming ? 'destructive' : 'default'}
        size="sm"
        onClick={handleRun}
        disabled={loading}
      >
        <Flame className={`mr-1.5 h-3 w-3 ${loading ? 'animate-pulse' : ''}`} />
        {loading ? '実行中...' : confirming ? '本当に発火する' : '発火'}
      </Button>

      {error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-1 rounded-md bg-muted/50 px-3 py-2 text-xs">
          <div className="font-mono text-muted-foreground">
            fired: {result.fired.length} · email:{' '}
            {result.emailSent ? '送信済' : skipEmail ? 'スキップ' : '送信せず'}
          </div>
          <ul className="space-y-0.5 font-mono">
            {result.fired.map((f) => (
              <li key={f.fermentationResultId}>
                {f.fermentationResultId.slice(0, 8)}: {f.questionText.slice(0, 60)}
                {f.questionText.length > 60 ? '…' : ''}
              </li>
            ))}
          </ul>
          {result.emailFailure && (
            <div className="text-destructive">email error: {result.emailFailure.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
