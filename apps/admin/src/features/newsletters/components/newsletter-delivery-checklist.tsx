'use client';

import { CheckCircle2, Circle, FlaskConical, Languages, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  formatBlockedReason,
  LOCALE_LABELS,
  type NewsletterPreview,
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
  /** 送信前の状態。未保存の新規や読み込み中は null。 */
  preview: NewsletterPreview | null;
  loadingPreview: boolean;
  translating: boolean;
  testSending: boolean;
  testResult: TestSendResult | null;
  /** 送信済み（もう何もできない）。 */
  readOnly: boolean;
  /** 未保存の新規下書き。 */
  unsaved: boolean;
  onTranslate: () => void;
  onSendTest: () => void;
  onOpenSend: () => void;
}

/**
 * 配信までの手順をエディタ画面にそのまま並べる。
 *
 * 以前は翻訳もテスト配信も「送信する…」ダイアログの中にあった。ボタンの字面が
 * 「送信する」なので、**押すと本当に全員へ送られると読める**。実際、最初に使った
 * 運営者は押すのをためらって手が止まった。取り消せない操作の手前に、取り消せる
 * 操作を隠してはいけない。
 *
 * 3 つを番号付きで並べ、いまどこまで済んでいるかを状態として出す。順番はデータ側でも
 * 強制されている（翻訳し直すとテストの印が落ちる）ので、見た目と実際の制約が一致する。
 */
export function NewsletterDeliveryChecklist({
  preview,
  loadingPreview,
  translating,
  testSending,
  testResult,
  readOnly,
  unsaved,
  onTranslate,
  onSendTest,
  onOpenSend,
}: Props) {
  if (unsaved) {
    return (
      <div className="rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
        下書きを保存すると、翻訳・テスト配信・送信ができるようになります。
      </div>
    );
  }

  if (readOnly) {
    return (
      <div className="rounded-md border border-border bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
        この配信は送信済みです。内容を変えるには新しい下書きを作ってください。
      </div>
    );
  }

  const busy = translating || testSending;
  // 宛先が日本語だけなら翻訳は要らない。「必要な言語: なし」と出すより、
  // 要らないと言い切るほうが迷わない。
  const needsTranslation = (preview?.locales ?? []).some(
    (l) => l.locale !== 'ja' && l.recipientCount > 0,
  );
  const translationsReady = preview !== null && preview.missingTranslations.length === 0;
  const tested = preview?.testSentAt != null;

  return (
    <div className="space-y-2 rounded-md border border-border px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        配信の準備
      </p>

      <Step
        index={1}
        done={translationsReady}
        title="翻訳"
        status={
          loadingPreview
            ? '読み込み中...'
            : preview === null
              ? '—'
              : !needsTranslation
                ? '日本語の宛先のみ。翻訳は要りません'
                : translationsReady
                  ? '宛先がいる言語はすべて揃っています'
                  : `必要: ${preview.missingTranslations.map((l) => LOCALE_LABELS[l]).join(' / ')}`
        }
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={onTranslate}
            disabled={busy || preview === null || !needsTranslation}
          >
            <Languages className={cn('mr-1.5 h-3 w-3', translating && 'animate-pulse')} />
            {translating ? '翻訳中...' : '翻訳を作成'}
          </Button>
        }
      />

      <Step
        index={2}
        done={tested}
        title="テスト配信"
        status={
          loadingPreview
            ? '読み込み中...'
            : preview === null
              ? '—'
              : tested && preview.testSentAt
                ? `${formatDateTime(preview.testSentAt)} に運営者へ送信済み`
                : '運営者だけに送って、実際に届く形を確認します'
        }
        detail={
          testResult?.sent
            ? `${testResult.delivered} 件送信 (${testResult.locales.join(' / ')}): ${testResult.recipients.join(', ')}`
            : undefined
        }
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={onSendTest}
            disabled={busy || preview === null}
          >
            <FlaskConical className={cn('mr-1.5 h-3 w-3', testSending && 'animate-pulse')} />
            {testSending ? '送信中...' : 'テスト配信'}
          </Button>
        }
      />

      <Step
        index={3}
        done={false}
        title="本番送信"
        status={
          loadingPreview
            ? '読み込み中...'
            : preview === null
              ? '—'
              : preview.blockedReason
                ? formatBlockedReason(preview.blockedReason)
                : `${preview.recipientCount} 名へ送ります。最終確認の画面が開きます`
        }
        action={
          <Button
            size="sm"
            onClick={onOpenSend}
            disabled={busy || preview === null || !preview.sendable}
          >
            <Send className="mr-1.5 h-3 w-3" />
            送信する…
          </Button>
        }
      />
    </div>
  );
}

function Step({
  index,
  done,
  title,
  status,
  detail,
  action,
}: {
  index: number;
  done: boolean;
  title: string;
  status: string;
  detail?: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <div className="flex min-w-0 items-start gap-2">
        {done ? (
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="text-[13px]">
            <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">{index}</span>
            {title}
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{status}</p>
          {detail && <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{detail}</p>}
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}
