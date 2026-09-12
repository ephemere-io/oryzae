'use client';

import { ACCEPTED_IMAGE_MIME_TYPES } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import { JAR_ICON_PATH } from '@/components/ui/icon-paths';
import { PhotoStrip } from '@/components/ui/photo-strip';
import { CONTROL_FONT, ELEVATED_CHIP_CLASS, ELEVATED_CHIP_STYLE } from '@/components/ui/surface';
import { useAutosaveEntry } from '@/features/shared/entries/hooks/use-autosave-entry';
import { useDeleteEntry } from '@/features/shared/entries/hooks/use-delete-entry';
import { useSaveEntry } from '@/features/shared/entries/hooks/use-entry';
import { useEntryDraft } from '@/features/shared/entries/hooks/use-entry-draft';
import { usePhotoImport } from '@/features/shared/entries/hooks/use-photo-import';
import type { AttachedPhoto, EntryDraft } from '@/features/shared/entries/types';
import {
  useActiveQuestions,
  useEntryQuestions,
} from '@/features/shared/entry-questions/hooks/use-entry-questions';
import type { LinkedQuestion } from '@/features/shared/entry-questions/types';
import { useFermentationForQuestion } from '@/features/shared/fermentation/hooks/use-fermentation-for-question';
import { useCreateQuestion } from '@/features/shared/questions/hooks/use-create-question';
import type { ApiClient } from '@/lib/api';
import { SpConfirmSheet } from './sp-confirm-sheet';
import { SpFermentationDrawer } from './sp-fermentation-drawer';
import { SpPhotoImportSheet } from './sp-photo-import-sheet';

interface SpEntryEditorProps {
  api: ApiClient | null;
  /** 手紙への返事など、URL の questionId を初期紐づけする（内省ループの接続）。 */
  initialQuestionId?: string | null;
  /** 既存エントリを編集するとき。新規作成時は undefined。 */
  initialEntryId?: string;
  /** 既存エントリの本文（先頭行=タイトル）。新規は空。 */
  initialContent?: string;
  /** 既存エントリに添えられている写真のストレージパス。新規は空。 */
  initialMediaUrls?: string[];
  /** 上と同じ並びの表示用 署名付き URL。 */
  initialMediaSignedUrls?: string[];
  /**
   * 書きかけドラフトの退避/復元を有効にするか（既定 true）。
   * 孤立検証（verify）では localStorage が fixture をまたいで漏れるため false にする。
   */
  persistDraft?: boolean;
}

/** content の先頭行をタイトル、残りを本文に分ける（エディタの保存形式）。 */
function splitTitleBody(raw: string): { title: string; body: string } {
  const idx = raw.indexOf('\n');
  if (idx === -1) return { title: '', body: raw };
  return { title: raw.slice(0, idx), body: raw.slice(idx + 1) };
}

/**
 * SP 版「書く」エディタ（Issue #363）。軽量・キャプチャ特化。
 * 縦長1カラム・全画面フォーカス・任意タイトル＋本文・自動保存。データの振る舞いは
 * features/shared の hook を PC と共有する。
 *
 * 仕様（インタビューで確定）: 演出/音声入力/スニペット/設定/文字数/発酵オーバーレイ/
 * 離脱ガードは持たない。下部バーに 小さなステータス・問い紐づけ・保存後の「瓶に漬ける」。
 * 瓶に漬けた後の自動遷移は持たない（インタビューで不要と確定）。
 */
export function SpEntryEditor({
  api,
  initialQuestionId = null,
  initialEntryId,
  initialContent = '',
  initialMediaUrls,
  initialMediaSignedUrls,
  persistDraft = true,
}: SpEntryEditorProps) {
  const t = useTranslations('sp.editor');
  const tDelete = useTranslations('entries.delete_modal');
  const tPhoto = useTranslations('photo');
  const router = useRouter();
  const { deleteEntry, deleting } = useDeleteEntry(api);
  const { save, saving, error } = useSaveEntry(api, null);
  const activeQuestions = useActiveQuestions(api, false);
  const { load: loadDraft, save: saveDraft, clear: clearDraft } = useEntryDraft();

  // ドラフト退避/復元は「素の新規フロー」だけで行う（既存編集・問い返信は対象外）。
  const draftEnabled = persistDraft && !initialEntryId && !initialQuestionId;
  // マウント時に一度だけ、新鮮なドラフトがあれば書きかけを復元する（+ 押し直しでの再開）。
  const [restored] = useState<EntryDraft | null>(() => (draftEnabled ? loadDraft() : null));

  // 既存エントリ編集なら content を タイトル/本文 に割って初期化（autosave は entryId 有りで更新）。
  const init = initialEntryId
    ? splitTitleBody(initialContent)
    : restored
      ? { title: restored.title, body: restored.body }
      : { title: '', body: initialContent };
  const resolvedEntryId = initialEntryId ?? restored?.entryId;
  const [title, setTitle] = useState(init.title);
  const [body, setBody] = useState(init.body);
  const [entryId, setEntryId] = useState<string | undefined>(resolvedEntryId);
  // サーバ保存済み（entryId あり）なら保存済み表示、未保存の復元ドラフトは「編集中」表示にする。
  const [lastSavedBody, setLastSavedBody] = useState(resolvedEntryId ? init.body : '');
  // Issue #510: タイトルだけ変えたときも「編集中」にする（本文だけ見ていると、
  // 未保存のタイトルを抱えたまま「保存済み」と表示してしまう）。
  const [lastSavedTitle, setLastSavedTitle] = useState(resolvedEntryId ? init.title.trim() : '');
  const [pickling, setPickling] = useState(false);
  const [pickled, setPickled] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    initialQuestionId ?? restored?.questionId ?? null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Issue #466 の SP 版: 紐づけた問いに完了済みの発酵があれば、下からのドロワーで出す。
  // 本文の上には重ねない（docs/entry-screen-design.md 原則1）。
  const [fermentDrawerOpen, setFermentDrawerOpen] = useState(false);
  const { detail: fermentationDetail } = useFermentationForQuestion(
    api,
    selectedQuestionId ?? undefined,
  );
  /**
   * 添えた写真。パスと表示 URL を **1 本の配列**で持つ。
   * 2 本に分けると、署名に失敗した写真がある時に index がずれ、
   * 「n 番目を削除」で別の写真を消してしまう（サーバは穴を空文字で埋めて返す）。
   */
  const [photos, setPhotos] = useState<AttachedPhoto[]>(() =>
    (initialMediaUrls ?? []).map((storagePath, i) => ({
      storagePath,
      signedUrl: initialMediaSignedUrls?.[i] ?? '',
    })),
  );
  const mediaUrls = useMemo(() => photos.map((p) => p.storagePath), [photos]);
  /** PC と同じ理由の鏡。await をまたぐ連続操作で古い配列を送らないため。 */
  const photosRef = useRef<AttachedPhoto[]>(photos);
  photosRef.current = photos;
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Issue #314: 問いが1つも無いと、シートが「ありません」を出すだけで手詰まりだった。
  // その場で問いを立てられるようにする（PC は #316 の QuestionSelectModal で既に可能）。
  const createQuestion = useCreateQuestion(api);
  // 「書く」に切り替えたい意思だけを持ち、モードは activeQuestions から導出する。
  // 開いた時点の件数で固定すると、問いの取得が終わる前にシートを開いた場合に
  // 一覧が来ても入力欄のままになる（選べる問いがあるのに選べない）。
  const [composeRequested, setComposeRequested] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [creatingQuestion, setCreatingQuestion] = useState(false);
  const [createQuestionFailed, setCreateQuestionFailed] = useState(false);
  // 作りたての問いは activeQuestions（マウント時に一度取るだけ）にも linkedQuestions
  // （紐づけ POST の往復後に入る）にも即座には現れない。チップのラベルが
  // 「問いを結ぶ」に戻って見えるのを避けるため、ここで覚えておく。
  const [createdQuestions, setCreatedQuestions] = useState<LinkedQuestion[]>([]);

  // 書きかけ（タイトル/本文/問い/entryId）を localStorage に退避する。内容が空になればクリア。
  // 発酵（瓶に納める）後は確定とみなして退避しない。
  useEffect(() => {
    if (!draftEnabled || pickled) return;
    if (!title.trim() && !body.trim()) {
      clearDraft();
      return;
    }
    saveDraft({ entryId, title, body, questionId: selectedQuestionId });
  }, [draftEnabled, pickled, title, body, entryId, selectedQuestionId, saveDraft, clearDraft]);

  const { linkedQuestions, linkQuestion, unlinkQuestion } = useEntryQuestions(api, entryId);

  useAutosaveEntry({
    title,
    body,
    entryId,
    save,
    mediaUrls,
    onSaved: (id, savedBody, savedTitle) => {
      setEntryId(id);
      setLastSavedBody(savedBody);
      setLastSavedTitle(savedTitle);
    },
    enabled: api != null,
  });

  /** 起こした文字をカーソル位置に差し込む（本文の全置換はしない）。 */
  function insertAtCursor(text: string) {
    const el = bodyRef.current;
    const at = el ? (el.selectionStart ?? body.length) : body.length;
    const before = body.slice(0, at);
    const after = body.slice(at);
    // 直前が改行でなければ改行を足して、既存の文と地続きにならないようにする。
    const lead = before && !before.endsWith('\n') ? '\n' : '';
    const next = `${before}${lead}${text}${after}`;
    setBody(next);
    // 差し込んだ直後にカーソルを末尾へ運ぶ（続きを書き始められるように）。
    requestAnimationFrame(() => {
      const target = bodyRef.current;
      if (!target) return;
      const caret = before.length + lead.length + text.length;
      target.focus();
      target.setSelectionRange(caret, caret);
    });
  }

  /**
   * 写真を添える。本文が未保存でも写真だけ先に確定させたいので、ここで明示的に保存する
   * （自動保存は本文が一定量変わるまで走らないため、貼っただけでは永続化されない）。
   */
  async function attachPhoto(photo: AttachedPhoto) {
    const updated = [...photosRef.current, photo];
    photosRef.current = updated; // 再レンダーを待たずに次の操作へ反映する
    setPhotos(updated);
    const next = updated.map((p) => p.storagePath);
    const content = title.trim() ? `${title.trim()}\n${body}` : body;
    if (!content.trim()) return; // 本文が空のうちは保存できない。次の保存で一緒に載る。
    const saved = await save(content, entryId, { mediaUrls: next });
    if (saved) setEntryId(saved);
  }

  async function removePhoto(index: number) {
    const updated = photosRef.current.filter((_, i) => i !== index);
    photosRef.current = updated;
    setPhotos(updated);
    const next = updated.map((p) => p.storagePath);
    const content = title.trim() ? `${title.trim()}\n${body}` : body;
    if (!entryId || !content.trim()) return;
    await save(content, entryId, { mediaUrls: next });
  }

  const photoImport = usePhotoImport({
    api,
    onAttach: attachPhoto,
    onInsertText: insertAtCursor,
  });

  // 問いはエントリ作成後（entryId 確定後）に一度だけ紐づける。
  // 保存前に選んでいた場合も、autosave でエントリが出来た時点で紐づく。
  const linkAttemptedRef = useRef<string | null>(null);

  // Issue #448: 既存エントリを一覧から開くと、紐づいている問いがチップに出ていなかった。
  // 選択状態の初期値は URL の questionId と復元ドラフトしか見ておらず、サーバの
  // 紐付け（linkedQuestions）を無視していたため。取得できたら一度だけ埋める。
  // ユーザーが既に選んでいる場合は上書きしない。復元した問いは紐付け済みなので、
  // 下の紐づけ effect が再 POST しないよう linkAttemptedRef にも印を付ける。
  const questionSeededRef = useRef(false);
  useEffect(() => {
    if (questionSeededRef.current) return;
    const linked = linkedQuestions[0];
    if (!linked) return;
    questionSeededRef.current = true;
    if (selectedQuestionId !== null) return;
    linkAttemptedRef.current = linked.id;
    setSelectedQuestionId(linked.id);
  }, [linkedQuestions, selectedQuestionId]);

  useEffect(() => {
    if (entryId && selectedQuestionId && linkAttemptedRef.current !== selectedQuestionId) {
      linkAttemptedRef.current = selectedQuestionId;
      linkQuestion(selectedQuestionId);
    }
  }, [entryId, selectedQuestionId, linkQuestion]);

  const dirty = body !== lastSavedBody || title.trim() !== lastSavedTitle;
  const hasBody = !!body.trim();
  const statusText = saving
    ? t('status_saving')
    : !hasBody
      ? ''
      : dirty
        ? t('status_editing')
        : t('status_saved');

  // 紐付け済みの問いが終了（アーカイブ）されていると activeQuestions に載らない。
  // その場合もチップには出したいので、紐付け側からも探す。
  const selectedQuestion =
    activeQuestions.find((q) => q.id === selectedQuestionId) ??
    linkedQuestions.find((q) => q.id === selectedQuestionId) ??
    createdQuestions.find((q) => q.id === selectedQuestionId);

  // 選べる問いが無ければ入力欄、あれば一覧。取得が遅れて届いても自動で一覧に切り替わる。
  const composingQuestion = composeRequested || activeQuestions.length === 0;

  // シートを開くたび、書きかけと失敗表示はリセットする（前回の状態を持ち越さない）。
  function openQuestionSheet() {
    setComposeRequested(false);
    setNewQuestionText('');
    setCreateQuestionFailed(false);
    setSheetOpen(true);
  }

  /**
   * 問いを選ぶ・外す・付け替える。
   *
   * 以前は選択を `null` にするだけで、**サーバーの紐づけは残ったまま**だった。別の問いを
   * 選ぶと両方が紐づき、チップには 1 つしか出ない（PC は unlink を持っている）。
   * 紐づけ済み（`linkAttemptedRef` がその問い）なら先に外し、次の問いは下の effect が
   * entryId 確定後に結ぶ。
   */
  function selectQuestion(nextId: string | null) {
    const previous = selectedQuestionId;
    if (previous !== null && previous !== nextId && linkAttemptedRef.current === previous) {
      linkAttemptedRef.current = null;
      if (entryId) unlinkQuestion(previous);
    }
    setSelectedQuestionId(nextId);
    setSheetOpen(false);
  }

  // 問いを立てて、そのまま選択状態にする。紐づけは下の effect が entryId 確定後に行う。
  async function handleCreateQuestion() {
    const text = newQuestionText.trim();
    if (!text || creatingQuestion) return;
    setCreatingQuestion(true);
    setCreateQuestionFailed(false);
    const id = await createQuestion(text);
    setCreatingQuestion(false);
    if (!id) {
      setCreateQuestionFailed(true);
      return;
    }
    setCreatedQuestions((prev) => [...prev, { id, currentText: text }]);
    setSelectedQuestionId(id);
    setNewQuestionText('');
    setSheetOpen(false);
  }

  async function handlePickle() {
    if (!entryId || pickling || pickled) return;
    // Issue #450: 問いに紐づいていないエントリは発酵ループに入らない。走査対象は
    // 「active な問いに紐づいたエントリ」だけなので（scheduled-fermentation.usecase）、
    // このまま押せると「漬けたのに何も届かない」になる。PC（#316）と同じく、先に問いを
    // 決めてもらう。タイトルは発酵に使われない（本文だけを読む）ので任意のままでよい。
    if (!selectedQuestionId) {
      openQuestionSheet();
      return;
    }
    setPickling(true);
    const content = title.trim() ? `${title.trim()}\n${body}` : body;
    const saved = await save(content, entryId, { fermentationEnabled: true, mediaUrls });
    setPickling(false);
    if (saved) {
      setPickled(true);
      clearDraft(); // 発酵させたら確定。書きかけドラフトは破棄する。
    }
  }

  // 確認シートで「削除する」→ API 削除が成功したら一覧へ戻る（フル遷移は不要・SPA で十分）。
  async function handleDelete() {
    if (!entryId) return;
    const ok = await deleteEntry(entryId);
    if (ok) {
      clearDraft();
      router.push('/entries');
    } else {
      setDeleteOpen(false);
    }
  }

  return (
    <div
      className="relative flex h-full flex-col bg-[var(--bg)] text-[var(--fg)]"
      style={{ fontFamily: 'var(--ob-font-serif)' }}
      {...verifyAttrs({
        unit: 'SpEntryEditor',
        hasBody,
        dirty,
        hasEntry: !!entryId,
        // Issue #448: 一覧から開いたときの復元の回帰を捕まえる。
        // Issue #450: 問いの有無で「納める」の挙動が変わる（無ければ問い選択を開く）。
        hasQuestion: selectedQuestionId !== null,
        sheetOpen,
        // Issue #314: 問いがゼロでも行き止まりにならないこと（入力欄が出ること）を捕まえる。
        composingQuestion,
        pickling,
        deleteOpen,
        hasFermentation: fermentationDetail !== null,
      })}
    >
      {/* 保存ステータス（右・常設）＋ 既存エントリの削除トリガー（左・⋯）。 */}
      <header
        className="flex items-center justify-between px-5 pt-3 pb-1"
        style={{ minHeight: 28 }}
      >
        {/* 既存エントリだけ削除できる（新規は削除対象が無いので出さない）。 */}
        {entryId ? (
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            aria-label={t('delete')}
            className="-ml-2 p-2 text-[var(--date-color)]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <title>more</title>
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
        <span
          aria-live="polite"
          className="flex items-center gap-1.5 text-xs"
          style={{
            ...CONTROL_FONT,
            color: error ? 'var(--ob-jar-warm)' : 'var(--accent)',
            opacity: statusText || error ? 1 : 0,
          }}
        >
          {saving ? (
            <span
              className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
              aria-hidden="true"
            />
          ) : statusText && !error ? (
            <span aria-hidden="true">✓</span>
          ) : null}
          {error || statusText || ' '}
        </span>
      </header>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('title_placeholder')}
        aria-label={t('title_placeholder')}
        className="w-full bg-transparent px-5 pt-2 text-2xl font-medium leading-snug outline-none placeholder:opacity-25"
      />

      {/* 問いを結ぶチップと写真。面は PC のチップ・パレット・「書斎に戻る」と同じ
          （ELEVATED_CHIP）。破線のピルを inline で並べていたころは、問いが長いと
          2 つ目が次の行に落ちて揃わなかった。 */}
      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <button
          type="button"
          onClick={openQuestionSheet}
          className={`flex h-8 min-w-0 max-w-full items-center px-3 text-[12px] font-medium ${ELEVATED_CHIP_CLASS}`}
          style={{
            ...ELEVATED_CHIP_STYLE,
            ...CONTROL_FONT,
            ...(selectedQuestion ? {} : { color: 'var(--date-color)' }),
          }}
        >
          <span className="truncate">
            {selectedQuestion
              ? `◦ ${selectedQuestion.currentText ?? t('question_untitled')}`
              : `+ ${t('question_link')}`}
          </span>
        </button>

        {/* 写真を取り込む。押すと端末のカメラ/ライブラリが開く。 */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label={tPhoto('toolbar_button')}
          className={`flex h-8 shrink-0 items-center whitespace-nowrap px-3 text-[12px] font-medium ${ELEVATED_CHIP_CLASS}`}
          style={{ ...ELEVATED_CHIP_STYLE, ...CONTROL_FONT, color: 'var(--date-color)' }}
        >
          {`+ ${tPhoto('toolbar_button')}`}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_IMAGE_MIME_TYPES.join(',')}
          aria-label={tPhoto('modal_title')}
          tabIndex={-1}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // 同じファイルを選び直しても change が起きるよう毎回リセットする。
            e.target.value = '';
            if (file) photoImport.selectFile(file);
          }}
        />
      </div>

      {/* 本文（タイトルから広い余白＋ゆったり行間）。指摘: 余白が欲しい。 */}
      <textarea
        ref={bodyRef}
        // biome-ignore lint/a11y/noAutofocus: 縦長フォーカスエディタは開いた瞬間に書き始められることが要件
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t('body_placeholder')}
        aria-label={t('body_placeholder')}
        className="mt-6 w-full flex-1 resize-none bg-transparent px-5 pb-4 text-base outline-none placeholder:opacity-30"
        style={{ lineHeight: 2 }}
      />

      {/* 添えた写真。本文の途中ではなく下にまとめて並べる（docs/entry-photo-guide.md）。 */}
      <PhotoStrip urls={photos.map((p) => p.signedUrl)} onRemove={removePhoto} />

      <SpPhotoImportSheet
        state={photoImport.state}
        onTranscribe={photoImport.transcribe}
        onAttach={photoImport.attach}
        onInsertTranscript={photoImport.insertTranscript}
        onDiscardTranscript={photoImport.discardTranscript}
        onClose={photoImport.close}
      />

      {/* 発酵させる CTA（保存済み＝entryId 確定後のみ）。
          バナー全体を1つの大きなボタンにして、シンプルで押しやすく（指摘対応）。 */}
      {entryId ? (
        <div className="sp-rise mx-4 mb-4">
          <button
            type="button"
            onClick={handlePickle}
            disabled={pickling || pickled}
            aria-label={t('ferment_title')}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-4 text-white transition-opacity disabled:cursor-default"
            style={{
              background: pickled
                ? 'color-mix(in srgb, var(--ob-jar-warm) 45%, var(--bg))'
                : 'var(--ob-jar-warm)',
              boxShadow:
                pickling || pickled
                  ? 'none'
                  : '0 8px 20px -8px color-mix(in srgb, var(--ob-jar-warm) 60%, transparent)',
              ...CONTROL_FONT,
            }}
          >
            {pickling ? (
              <span
                className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-white border-t-transparent"
                aria-hidden="true"
              />
            ) : (
              <svg
                className="h-5 w-5 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                aria-hidden="true"
              >
                <path d={JAR_ICON_PATH} strokeLinejoin="round" />
                {/* 中身（発酵しているもの）の水位。胴の幅に合わせる。 */}
                <path d="M6.6 14.4c1.8.8 3.6.8 5.4 0s3.6-.8 5.4 0" strokeOpacity=".55" />
              </svg>
            )}
            <span className="text-[15px] font-bold">
              {pickling ? t('pickling') : pickled ? t('pickled') : t('ferment_title')}
            </span>
          </button>
          {!pickled ? (
            <p className="mt-2 text-center text-xs leading-snug opacity-55">{t('ferment_sub')}</p>
          ) : null}
        </div>
      ) : null}

      {sheetOpen ? (
        <div className="absolute inset-0 z-10 flex flex-col justify-end">
          <button
            type="button"
            aria-label={t('close')}
            onClick={() => setSheetOpen(false)}
            className="sp-fade flex-1 bg-black/30"
          />
          {/* 60% だとキーボードが出た瞬間に一覧が隠れた。85% まで使う。 */}
          <div className="sp-sheet max-h-[85%] overflow-auto rounded-t-2xl bg-[var(--bg)] pb-6 shadow-[0_-8px_24px_rgba(0,0,0,0.15)]">
            <div
              className="px-5 py-4 text-[11px] uppercase tracking-[0.14em]"
              style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
            >
              {t('question_sheet_title')}
            </div>
            {composingQuestion ? (
              <div className="px-5 pb-2">
                {activeQuestions.length === 0 ? (
                  <p className="pb-3 text-sm opacity-50">{t('question_empty')}</p>
                ) : null}
                <input
                  // biome-ignore lint/a11y/noAutofocus: 問いが無くて手が止まっている場面なので、開いた瞬間に書き始められる必要がある
                  autoFocus
                  value={newQuestionText}
                  onChange={(e) => setNewQuestionText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateQuestion();
                    }
                  }}
                  placeholder={t('question_new_placeholder')}
                  aria-label={t('question_new_placeholder')}
                  className="w-full rounded-xl px-4 py-3 text-base outline-none"
                  style={{
                    background: 'color-mix(in srgb, var(--fg) 5%, transparent)',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
                {createQuestionFailed ? (
                  <p className="pt-2 text-xs" style={{ color: 'var(--danger, #c0392b)' }}>
                    {t('question_create_failed')}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={handleCreateQuestion}
                  disabled={!newQuestionText.trim() || creatingQuestion}
                  className="mt-3 w-full rounded-xl py-3 text-base font-medium disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                >
                  {creatingQuestion ? t('question_creating') : t('question_create')}
                </button>
                {activeQuestions.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setComposeRequested(false)}
                    className="mt-2 w-full py-2 text-sm opacity-60"
                  >
                    {t('question_back_to_list')}
                  </button>
                ) : null}
              </div>
            ) : (
              <>
                <ul>
                  {activeQuestions.map((q) => {
                    const selected = q.id === selectedQuestionId;
                    return (
                      <li key={q.id}>
                        <button
                          type="button"
                          onClick={() => selectQuestion(selected ? null : q.id)}
                          className="flex min-h-[48px] w-full items-center justify-between px-5 py-3 text-left text-base hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)]"
                          aria-pressed={selected}
                        >
                          <span className="truncate">
                            {q.currentText ?? t('question_untitled')}
                          </span>
                          {selected ? (
                            <span className="ml-3 shrink-0" style={{ color: 'var(--accent)' }}>
                              ✓
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  onClick={() => {
                    setCreateQuestionFailed(false);
                    setComposeRequested(true);
                  }}
                  className="min-h-[48px] w-full px-5 py-3 text-left text-[15px] font-medium"
                  style={{ ...CONTROL_FONT, color: 'var(--accent)' }}
                >
                  {t('question_new')}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Issue #466（SP 版）: 発酵結果は本文に重ねず、下からのドロワーに集約する。 */}
      {fermentationDetail && (
        <SpFermentationDrawer
          detail={fermentationDetail}
          open={fermentDrawerOpen}
          onOpenChange={setFermentDrawerOpen}
        />
      )}

      <SpConfirmSheet
        open={deleteOpen}
        title={tDelete('heading')}
        message={tDelete('body')}
        confirmLabel={tDelete('confirm')}
        cancelLabel={tDelete('cancel')}
        destructive
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  );
}
