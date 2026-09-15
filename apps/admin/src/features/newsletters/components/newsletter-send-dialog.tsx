'use client';

import { AlertTriangle, Send } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  formatBlockedReason,
  formatSendSkipReason,
  LOCALE_LABELS,
  type NewsletterLocale,
  type NewsletterPreview,
  type SendResult,
  type TestSendResult,
} from '../types';

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  }).format(date);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: NewsletterPreview | null;
  result: SendResult | null;
  /** 直前のテスト配信の結果。テスト済みの時刻を最新に保つために見る。 */
  testResult: TestSendResult | null;
  loadingPreview: boolean;
  sending: boolean;
  error: string | null;
  onSend: () => void;
}

/**
 * 送信前の **最終確認だけ** を行う (issue #614 の制約)。
 *
 * 1. 実際に届く HTML をそのまま出す（言語ごと）
 * 2. 何名に送られるかを出す
 * 3. 2 段階の確認を経ないと送れない
 *
 * 翻訳とテスト配信はここに置かない。取り消せる操作を「送信する」の中に隠すと、
 * 押していいのか分からず手が止まる（実際に止まった）。それらはエディタ画面の
 * `NewsletterDeliveryChecklist` にある。
 *
 * HTML は **iframe に sandbox で閉じ込めて** 描画する。メールの HTML は
 * admin 画面とは無関係の CSS を持つので、直接差し込むと管理画面の見た目を
 * 壊す。sandbox="" にしてあるので、万一 script が混ざっても動かない。
 */
export function NewsletterSendDialog({
  open,
  onOpenChange,
  preview,
  result,
  testResult,
  loadingPreview,
  sending,
  error,
  onSend,
}: Props) {
  const [confirming, setConfirming] = useState(false);
  const [format, setFormat] = useState<'html' | 'text'>('html');
  // どの言語版を見ているか。既定は原文。
  const [locale, setLocale] = useState<NewsletterLocale>('ja');

  // 直前に撃ったテストの結果を優先する（プレビューは開いた時点の値なので、
  // ダイアログを開いたままテスト配信すると古いままになる）。
  const testedAt = testResult?.newsletter.testSentAt ?? preview?.testSentAt ?? null;
  const shown = preview?.locales.find((l) => l.locale === locale) ?? null;

  function handleOpenChange(next: boolean) {
    // 開き直したときに確認済みの状態が残っていると、1 クリックで送れてしまう。
    if (!next) setConfirming(false);
    onOpenChange(next);
  }

  function handleSend() {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    onSend();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>送信の確認</DialogTitle>
          <DialogDescription>実際に届くメールです。送信すると取り消せません。</DialogDescription>
        </DialogHeader>

        {loadingPreview && (
          <p className="py-8 text-center text-sm text-muted-foreground">読み込み中...</p>
        )}

        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {preview && !result && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
              <div className="text-sm">
                <span className="text-muted-foreground">宛先: </span>
                <span className="font-medium">{preview.recipientCount} 名</span>
                <span className="ml-2 text-[11px] text-muted-foreground">
                  （メール確認済み・配信停止していない登録者）
                </span>
              </div>
              <div className="flex items-center gap-0.5">
                {(['html', 'text'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormat(value)}
                    className={`rounded-md px-2 py-1 text-xs transition-colors ${
                      format === value
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {value === 'html' ? 'HTML' : 'テキスト'}
                  </button>
                ))}
              </div>
            </div>

            {/* 言語ごとに実際に届くものを見る。日本語だけ見て送ると、英語版が
                崩れていても気づけない。宛先 0 名の言語も並べる（存在は見せる）。 */}
            <div className="flex flex-wrap items-center gap-1">
              {preview.locales.map((entry) => {
                const missing = entry.html === null;
                return (
                  <button
                    key={entry.locale}
                    type="button"
                    onClick={() => setLocale(entry.locale)}
                    className={`rounded-md px-2 py-1 text-xs transition-colors ${
                      locale === entry.locale
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {LOCALE_LABELS[entry.locale]}
                    <span className="ml-1 font-mono text-[10px] opacity-70">
                      {entry.recipientCount}
                    </span>
                    {missing && entry.recipientCount > 0 && (
                      <span className="ml-1 text-destructive">!</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="text-sm">
              <span className="text-muted-foreground">件名: </span>
              <span className="font-medium">{shown?.subject ?? preview.subject}</span>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border">
              {shown?.html == null ? (
                <p className="flex h-[46vh] items-center justify-center px-6 text-center text-xs text-muted-foreground">
                  この言語の翻訳がまだありません。「翻訳を作成」を押すと、宛先がいる言語ぶんが作られます。
                </p>
              ) : format === 'html' ? (
                <iframe
                  title="メールのプレビュー"
                  srcDoc={shown.html}
                  sandbox=""
                  className="h-[46vh] w-full bg-white"
                />
              ) : (
                <pre className="h-[46vh] overflow-auto bg-background p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
                  {shown.text}
                </pre>
              )}
            </div>

            {preview.blockedReason && (
              <div className="flex items-start gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{formatBlockedReason(preview.blockedReason)}</span>
              </div>
            )}

            {/* ここは最終確認だけ。翻訳もテスト配信もエディタ画面で済ませてから来る。 */}
            <p className="text-[11px] text-muted-foreground">
              {testedAt ? `テスト配信済み（${formatDateTime(testedAt)}）` : 'テスト配信がまだです'}
            </p>

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
                やめる
              </Button>
              <Button
                variant={confirming ? 'destructive' : 'default'}
                size="sm"
                onClick={handleSend}
                disabled={sending || !preview.sendable}
              >
                <Send className={`mr-1.5 h-3 w-3 ${sending ? 'animate-pulse' : ''}`} />
                {sending
                  ? '送信中...'
                  : confirming
                    ? `本当に ${preview.recipientCount} 名へ送る`
                    : '送信する'}
              </Button>
            </div>
          </>
        )}

        {result && (
          <div className="space-y-2 rounded-md bg-muted/50 px-3 py-3 text-sm">
            {result.sent ? (
              <>
                <p className="font-medium">
                  {result.delivered} 名へ送信しました
                  {result.failed > 0 && (
                    <span className="text-destructive"> / {result.failed} 名は失敗</span>
                  )}
                </p>
                {Object.keys(result.sentByLocale).length > 0 && (
                  <p className="font-mono text-xs text-muted-foreground">
                    {Object.entries(result.sentByLocale)
                      .map(([l, n]) => `${l}: ${n}`)
                      .join(' · ')}
                  </p>
                )}
                {result.failureReasons.length > 0 && (
                  <ul className="space-y-0.5 font-mono text-xs text-muted-foreground">
                    {result.failureReasons.map((failure) => (
                      <li key={failure.reason}>
                        {failure.count} 件: {failure.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <p className="font-medium text-destructive">送信されませんでした</p>
                <p className="text-xs text-muted-foreground">
                  理由: {formatSendSkipReason(result.reason)}
                </p>
                <p className="text-xs text-muted-foreground">
                  下書きのままなので、設定を直せばもう一度送れます。
                </p>
              </>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={() => handleOpenChange(false)}>
                閉じる
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
