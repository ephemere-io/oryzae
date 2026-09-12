'use client';

import { FilePlus2, RefreshCw, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NewsletterEditor } from '@/features/newsletters/components/newsletter-editor';
import { NewsletterList } from '@/features/newsletters/components/newsletter-list';
import { NewsletterSendDialog } from '@/features/newsletters/components/newsletter-send-dialog';
import { useNewsletterMutations } from '@/features/newsletters/hooks/use-newsletter-mutations';
import { useNewsletterSend } from '@/features/newsletters/hooks/use-newsletter-send';
import { useNewsletters } from '@/features/newsletters/hooks/use-newsletters';
import type { GenerateDraftResult, Newsletter } from '@/features/newsletters/types';

export default function NewslettersPage() {
  const { data, loading, error: listError, refresh } = useNewsletters();
  const mutations = useNewsletterMutations();
  const send = useNewsletterSend();

  // 選択中の配信。null = 未保存の新規下書き。
  const [selected, setSelected] = useState<Newsletter | null>(null);
  const [subject, setSubject] = useState('');
  const [bodyMarkdown, setBodyMarkdown] = useState('');
  const [sendOpen, setSendOpen] = useState(false);
  const [generated, setGenerated] = useState<GenerateDraftResult['source'] | null>(null);

  function openNewsletter(newsletter: Newsletter) {
    setSelected(newsletter);
    setSubject(newsletter.subject);
    setBodyMarkdown(newsletter.bodyMarkdown);
    setGenerated(null);
    mutations.resetError();
  }

  function startNewDraft() {
    setSelected(null);
    setSubject('');
    setBodyMarkdown('');
    setGenerated(null);
    mutations.resetError();
  }

  async function handleSave() {
    const content = { subject, bodyMarkdown };
    const saved = selected
      ? await mutations.update(selected.id, content)
      : await mutations.create(content);
    if (!saved) return;
    setSelected(saved);
    await refresh();
  }

  async function handleDelete() {
    if (!selected) return;
    const ok = await mutations.remove(selected.id);
    if (!ok) return;
    startNewDraft();
    await refresh();
  }

  async function handleGenerate() {
    const result = await mutations.generateDraft();
    if (!result) return;
    openNewsletter(result.newsletter);
    setGenerated(result.source);
    await refresh();
  }

  async function handleOpenSend() {
    if (!selected) return;
    setSendOpen(true);
    await send.loadPreview(selected.id);
  }

  async function handleSend() {
    if (!selected) return;
    const result = await send.send(selected.id);
    if (!result) return;
    // 送信後は状態（sent / draft のまま）が変わるので、選択中も一覧も入れ替える。
    setSelected(result.newsletter);
    await refresh();
  }

  function handleSendDialogChange(open: boolean) {
    setSendOpen(open);
    if (!open) send.reset();
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium">Newsletter</h1>
          <span className="text-sm text-muted-foreground">
            {data.filter((n) => n.status === 'sent').length} 件送信済み
            <span className="mx-1.5 text-border">|</span>
            {data.filter((n) => n.status === 'draft').length} 件下書き
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="xs" onClick={handleGenerate} disabled={mutations.saving}>
            <Sparkles className="mr-1.5 h-3 w-3" />
            {mutations.saving ? '生成中...' : 'PR から下書きを生成'}
          </Button>
          <Button variant="outline" size="xs" onClick={startNewDraft}>
            <FilePlus2 className="mr-1.5 h-3 w-3" />
            新規
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {listError && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {listError}
        </div>
      )}
      {mutations.error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {mutations.error}
        </div>
      )}

      {generated && (
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
          <p className="text-muted-foreground">
            {generated.since
              ? `前回配信 (${new Date(generated.since).toLocaleDateString('ja-JP')}) 以降の`
              : '直近の'}{' '}
            {generated.pullRequestCount} 件の PR
            を読んで下書きを作りました。事実確認のうえ書き直してください。
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {generated.pullRequests.slice(0, 10).map((pr) => (
              <li key={pr.number}>
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] text-muted-foreground hover:text-foreground hover:underline"
                >
                  #{pr.number} {pr.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[18rem_1fr]">
        <aside className="min-h-0 overflow-y-auto rounded-md border border-border p-1.5">
          {loading && data.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">Loading...</p>
          ) : (
            <NewsletterList
              items={data}
              selectedId={selected?.id ?? null}
              onSelect={openNewsletter}
            />
          )}
        </aside>

        <section className="min-h-0 rounded-md border border-border p-4">
          <NewsletterEditor
            newsletter={selected}
            subject={subject}
            bodyMarkdown={bodyMarkdown}
            onSubjectChange={setSubject}
            onBodyChange={setBodyMarkdown}
            onSave={handleSave}
            onDelete={handleDelete}
            onOpenSend={handleOpenSend}
            saving={mutations.saving}
          />
        </section>
      </div>

      <NewsletterSendDialog
        open={sendOpen}
        onOpenChange={handleSendDialogChange}
        preview={send.preview}
        result={send.result}
        loadingPreview={send.loadingPreview}
        sending={send.sending}
        error={send.error}
        onSend={handleSend}
      />
    </div>
  );
}
