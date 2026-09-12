'use client';

import { Send, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Newsletter } from '../types';

// server の domain と同じ上限。超えた状態で保存を押させない（往復して初めて
// 弾かれると、長い本文を書いたあとで気づくことになる）。
const MAX_SUBJECT_LENGTH = 120;
const MAX_BODY_LENGTH = 20_000;

interface Props {
  /** 編集中の下書き。未保存の新規は null。 */
  newsletter: Newsletter | null;
  subject: string;
  bodyMarkdown: string;
  onSubjectChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onOpenSend: () => void;
  saving: boolean;
}

export function NewsletterEditor({
  newsletter,
  subject,
  bodyMarkdown,
  onSubjectChange,
  onBodyChange,
  onSave,
  onDelete,
  onOpenSend,
  saving,
}: Props) {
  // 送信済み・送信中は読み取り専用。届いた文面と画面が食い違わないようにする。
  const readOnly = newsletter !== null && newsletter.status !== 'draft';
  const subjectTooLong = subject.length > MAX_SUBJECT_LENGTH;
  const bodyTooLong = bodyMarkdown.length > MAX_BODY_LENGTH;
  const canSave =
    !readOnly &&
    !saving &&
    subject.trim().length > 0 &&
    bodyMarkdown.trim().length > 0 &&
    !subjectTooLong &&
    !bodyTooLong;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="newsletter-subject" className="text-xs text-muted-foreground">
            件名
          </label>
          <span
            className={`font-mono text-[10px] ${
              subjectTooLong ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {subject.length} / {MAX_SUBJECT_LENGTH}
          </span>
        </div>
        <input
          id="newsletter-subject"
          type="text"
          value={subject}
          readOnly={readOnly}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="例: Oryzae の 9 月の更新"
          className="h-9 w-full rounded-md border border-border bg-transparent px-3 text-sm placeholder:text-muted-foreground read-only:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col space-y-1">
        <div className="flex items-center justify-between">
          <label htmlFor="newsletter-body" className="text-xs text-muted-foreground">
            本文（Markdown サブセット: ## 見出し / - 箇条書き / **太字** / [文字](URL)）
          </label>
          <span
            className={`font-mono text-[10px] ${
              bodyTooLong ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {bodyMarkdown.length} / {MAX_BODY_LENGTH}
          </span>
        </div>
        <textarea
          id="newsletter-body"
          value={bodyMarkdown}
          readOnly={readOnly}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder={'こんにちは。Oryzae の更新をお知らせします。\n\n## 新機能\n\n- ...'}
          className="min-h-64 flex-1 resize-none rounded-md border border-border bg-transparent p-3 font-mono text-[13px] leading-relaxed placeholder:text-muted-foreground read-only:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {newsletter?.lastError && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          前回の送信が完了しませんでした: {newsletter.lastError}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={onSave} disabled={!canSave}>
            {saving ? '保存中...' : '下書きを保存'}
          </Button>
          {newsletter && !readOnly && (
            <Button variant="ghost" size="sm" onClick={onDelete} disabled={saving}>
              <Trash2 className="mr-1.5 h-3 w-3" />
              削除
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onOpenSend}
          // 未保存の下書きは送れない。画面のテキストではなく保存済みの本文が送られる
          // ため、「見ているものと違うものが届く」状態を作らない。
          disabled={newsletter === null || readOnly}
          title={
            newsletter === null
              ? 'まず下書きを保存してください'
              : readOnly
                ? 'この配信は送信済みです'
                : undefined
          }
        >
          <Send className="mr-1.5 h-3 w-3" />
          送信する…
        </Button>
      </div>

      {readOnly && (
        <p className="text-[11px] text-muted-foreground">
          送信済みの配信は編集できません。内容を変えるには新しい下書きを作ってください。
        </p>
      )}
    </div>
  );
}
