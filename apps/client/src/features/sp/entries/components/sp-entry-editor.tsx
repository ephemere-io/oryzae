'use client';

import { ACCEPTED_IMAGE_MIME_TYPES } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionPalette } from '@/components/ui/action-palette';
import { FermentIcon, PhotoIcon, TrashIcon } from '@/components/ui/palette-icons';
import { PhotoStrip } from '@/components/ui/photo-strip';
import { GearIcon, RoundButton } from '@/components/ui/round-button';
import { CONTROL_FONT } from '@/components/ui/surface';
import { useAutosaveEntry } from '@/features/shared/entries/hooks/use-autosave-entry';
import { useDeleteEntry } from '@/features/shared/entries/hooks/use-delete-entry';
import {
  SP_EDITOR_TYPOGRAPHY,
  useEditorDisplay,
} from '@/features/shared/entries/hooks/use-editor-display';
import { useSaveEntry } from '@/features/shared/entries/hooks/use-entry';
import { useEntryDraft } from '@/features/shared/entries/hooks/use-entry-draft';
import { usePhotoImport } from '@/features/shared/entries/hooks/use-photo-import';
import type { AttachedPhoto, EntryDraft } from '@/features/shared/entries/types';
import { QuestionPicker } from '@/features/shared/entry-questions/components/question-picker';
import {
  useActiveQuestions,
  useEntryQuestions,
} from '@/features/shared/entry-questions/hooks/use-entry-questions';
import type { LinkedQuestion } from '@/features/shared/entry-questions/types';
import { useFermentationForQuestion } from '@/features/shared/fermentation/hooks/use-fermentation-for-question';
import { useCreateQuestion } from '@/features/shared/questions/hooks/use-create-question';
import type { ApiClient } from '@/lib/api';
import { placeInSlot, useSpBackHandler, useSpChrome, useSpStatus } from '@/lib/sp-chrome-context';
import { SpConfirmSheet } from './sp-confirm-sheet';
import { SpEditorSettingsSheet } from './sp-editor-settings-sheet';
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
  const tNav = useTranslations('sp.nav');
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
  /**
   * 結んでいる問い。**複数**（PC と同じ。以前は 1 つに限っていて、別の問いを選ぶと前のを外していた）。
   * URL の問い、または復元したドラフトの問いから始める。
   */
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>(() => {
    const first = initialQuestionId ?? restored?.questionId ?? null;
    return first ? [first] : [];
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  // 本文の見た目（書体・文字サイズ・行間・字間）。上段の右端の歯車から開く。
  const [display, updateDisplay] = useEditorDisplay();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bodyStyle = {
    fontFamily: SP_EDITOR_TYPOGRAPHY.fontFamily[display.fontFamily],
    fontSize: SP_EDITOR_TYPOGRAPHY.fontSize[display.fontSize],
    lineHeight: SP_EDITOR_TYPOGRAPHY.lineHeight[display.lineHeight],
    letterSpacing: SP_EDITOR_TYPOGRAPHY.letterSpacing[display.letterSpacing],
  };
  const [deleteOpen, setDeleteOpen] = useState(false);
  // Issue #466 の SP 版: 紐づけた問いに完了済みの発酵があれば、下からのドロワーで出す。
  // 本文の上には重ねない（docs/entry-screen-design.md 原則1）。
  const [fermentDrawerOpen, setFermentDrawerOpen] = useState(false);
  const { detail: fermentationDetail } = useFermentationForQuestion(api, selectedQuestionIds[0]);
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
    // ドラフトは問いを 1 つだけ持つ（先頭）。残りは保存後の紐づけが正になる。
    saveDraft({ entryId, title, body, questionId: selectedQuestionIds[0] ?? null });
  }, [draftEnabled, pickled, title, body, entryId, selectedQuestionIds, saveDraft, clearDraft]);

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
  const linkAttemptedRef = useRef(new Set<string>());

  // Issue #448: 既存エントリを一覧から開くと、紐づいている問いがチップに出ていなかった。
  // 選択状態の初期値は URL の questionId と復元ドラフトしか見ておらず、サーバの
  // 紐付け（linkedQuestions）を無視していたため。取得できたら一度だけ埋める。
  // ユーザーが既に選んでいる場合は上書きしない。復元した問いは紐付け済みなので、
  // 下の紐づけ effect が再 POST しないよう linkAttemptedRef にも印を付ける。
  const questionSeededRef = useRef(false);
  useEffect(() => {
    if (questionSeededRef.current) return;
    if (linkedQuestions.length === 0) return;
    questionSeededRef.current = true;
    // URL や復元で既に問いを持っていれば、サーバーの紐づけで上書きしない。
    if (selectedQuestionIds.length > 0) return;
    for (const linked of linkedQuestions) linkAttemptedRef.current.add(linked.id);
    setSelectedQuestionIds(linkedQuestions.map((linked) => linked.id));
  }, [linkedQuestions, selectedQuestionIds]);

  // entryId が確定したら、まだ結んでいない問いを結ぶ（複数）。
  useEffect(() => {
    if (!entryId) return;
    for (const id of selectedQuestionIds) {
      if (linkAttemptedRef.current.has(id)) continue;
      linkAttemptedRef.current.add(id);
      linkQuestion(id);
    }
  }, [entryId, selectedQuestionIds, linkQuestion]);

  const dirty = body !== lastSavedBody || title.trim() !== lastSavedTitle;
  const hasBody = !!body.trim();
  const statusText = saving
    ? t('status_saving')
    : !hasBody
      ? ''
      : dirty
        ? t('status_editing')
        : t('status_saved');
  // 状態は上段（SpTopBar）の中央へ。発酵を始めたらそれを最優先で言う。
  const chrome = useSpChrome();
  useSpStatus(
    error ?? (pickled ? t('pickled') : statusText),
    error ? 'error' : saving ? 'saving' : 'ok',
  );

  // 紐付け済みの問いが終了（アーカイブ）されていると activeQuestions に載らない。
  // その場合もチップには出したいので、紐付け側からも探す。
  const selectedQuestions: LinkedQuestion[] = selectedQuestionIds.map(
    (id) =>
      activeQuestions.find((q) => q.id === id) ??
      linkedQuestions.find((q) => q.id === id) ??
      createdQuestions.find((q) => q.id === id) ?? { id, currentText: null },
  );

  // 選べる問いが無ければ入力欄、あれば一覧。取得が遅れて届いても自動で一覧に切り替わる。
  const composingQuestion = composeRequested || activeQuestions.length === 0;

  // 開くたび、一覧のモードに戻す（前回の状態を持ち越さない）。
  function openQuestionPicker() {
    setComposeRequested(false);
    setPickerOpen(true);
  }
  const closePicker = useCallback(() => setPickerOpen(false), []);
  // 開いている間は、上段の戻るが選び手を閉じる（書斎へは戻らない）。
  useSpBackHandler(pickerOpen ? closePicker : null);

  /**
   * 問いを結ぶ／外す。**複数結べる**（PC と同じ）。
   *
   * 外すときは、紐づけ済み（`linkAttemptedRef` にある）ならサーバーの紐づけも解く。
   * 結ぶときは選択に足すだけで、紐づけは entryId 確定後の effect が行う。選び手は閉じない。
   */
  function toggleQuestion(id: string) {
    if (selectedQuestionIds.includes(id)) {
      if (linkAttemptedRef.current.has(id)) {
        linkAttemptedRef.current.delete(id);
        if (entryId) unlinkQuestion(id);
      }
      setSelectedQuestionIds((previous) => previous.filter((it) => it !== id));
      return;
    }
    setSelectedQuestionIds((previous) => [...previous, id]);
  }

  // 問いを立てて、そのまま結ぶ。紐づけは上の effect が entryId 確定後に行う。
  async function handleCreateQuestion(text: string): Promise<string | null> {
    const id = await createQuestion(text);
    if (!id) return null;
    setCreatedQuestions((prev) => [...prev, { id, currentText: text }]);
    setSelectedQuestionIds((previous) => [...previous, id]);
    setComposeRequested(false);
    return id;
  }

  async function handlePickle() {
    if (!entryId || pickling || pickled) return;
    // Issue #450: 問いに紐づいていないエントリは発酵ループに入らない。走査対象は
    // 「active な問いに紐づいたエントリ」だけなので（scheduled-fermentation.usecase）、
    // このまま押せると「漬けたのに何も届かない」になる。PC（#316）と同じく、先に問いを
    // 決めてもらう。タイトルは発酵に使われない（本文だけを読む）ので任意のままでよい。
    if (selectedQuestionIds.length === 0) {
      openQuestionPicker();
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
      // SP に一覧の画面は無い（一覧は書斎の手帳から開く）。消したら書斎へ。
      router.push('/');
    } else {
      setDeleteOpen(false);
    }
  }

  return (
    <div
      className="relative flex h-full flex-col bg-[var(--bg)] text-[var(--fg)]"
      {...verifyAttrs({
        unit: 'SpEntryEditor',
        hasBody,
        dirty,
        hasEntry: !!entryId,
        // Issue #448: 一覧から開いたときの復元の回帰を捕まえる。
        // Issue #450: 問いの有無で「納める」の挙動が変わる（無ければ問い選択を開く）。
        hasQuestion: selectedQuestionIds.length > 0,
        pickerOpen,
        // Issue #314: 問いがゼロでも行き止まりにならないこと（入力欄が出ること）を捕まえる。
        composingQuestion,
        pickling,
        deleteOpen,
        hasFermentation: fermentationDetail !== null,
      })}
    >
      {/* 保存の状態は上段（SpTopBar）の中央に出す。上段が無い場所（孤立検証・テスト）では
          ここに小さく出す。削除・写真・発酵はキーボード上のパレットへ。 */}
      {!chrome.mounted ? (
        <p
          aria-live="polite"
          className="px-6 pt-3 text-xs"
          style={{
            ...CONTROL_FONT,
            color: error ? 'var(--ob-jar-warm)' : 'var(--accent)',
            opacity: statusText || error ? 1 : 0,
          }}
        >
          {error || statusText || ' '}
        </p>
      ) : null}

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('title_placeholder')}
        aria-label={t('title_placeholder')}
        className="w-full bg-transparent px-6 pt-3 text-2xl font-medium leading-snug outline-none placeholder:opacity-25"
        style={{ fontFamily: bodyStyle.fontFamily, letterSpacing: bodyStyle.letterSpacing }}
      />

      {/* 結んでいる問い。題の下の行（Notion の見出し下のプロパティと同じ席）。
          面は持たず、◦ と本文の書体で。複数結べる。× で外す。「+ 問いを結ぶ」でその場に選び手が開く。 */}
      <div className="mx-6 mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {selectedQuestions.map((question) => (
          <span key={question.id} className="flex max-w-full items-center">
            <button
              type="button"
              onClick={openQuestionPicker}
              className="min-h-[32px] min-w-0 truncate text-left text-[13px]"
              style={{ color: 'var(--fg)' }}
            >
              {`◦ ${question.currentText ?? t('question_untitled')}`}
            </button>
            <button
              type="button"
              aria-label={t('question_unlink', {
                label: question.currentText ?? t('question_untitled'),
              })}
              onClick={() => toggleQuestion(question.id)}
              className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[15px] leading-none hover:bg-[var(--hover-wash)]"
              style={{ color: 'var(--date-color)' }}
            >
              ×
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={openQuestionPicker}
          className="min-h-[32px] text-left text-[13px]"
          style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
        >
          {`+ ${t('question_link')}`}
        </button>
      </div>
      {pickerOpen ? (
        <div className="mx-6 mt-2">
          <QuestionPicker
            questions={activeQuestions}
            selectedIds={selectedQuestionIds}
            onToggle={toggleQuestion}
            onCreate={handleCreateQuestion}
            composing={composingQuestion}
            onComposingChange={setComposeRequested}
            onClose={closePicker}
          />
        </div>
      ) : null}
      {/* 写真を取り込む入口（実体）。押すのはパレットの写真ボタン。 */}
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

      {/* 本文（タイトルから広い余白＋ゆったり行間）。指摘: 余白が欲しい。 */}
      <textarea
        ref={bodyRef}
        // biome-ignore lint/a11y/noAutofocus: 縦長フォーカスエディタは開いた瞬間に書き始められることが要件
        autoFocus
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t('body_placeholder')}
        aria-label={t('body_placeholder')}
        className="mt-6 w-full flex-1 resize-none bg-transparent px-6 pb-4 outline-none placeholder:opacity-30"
        style={bodyStyle}
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

      {/* 操作は殻の下端の列に集める（キーボードが出ればその真上。Notion のキーボード
          ツールバーの席）。問いを結ぶのは題の下の行が担うので列には置かない。
          発酵は保存済み（entryId 確定後）のときだけ並ぶ。 */}
      {placeInSlot(
        <ActionPalette
          ariaLabel={t('palette_aria')}
          keyboardOpen={chrome.keyboardOpen}
          dismissKeyboardLabel={tNav('dismiss_keyboard')}
          actions={[
            {
              id: 'photo',
              label: tPhoto('toolbar_button'),
              icon: <PhotoIcon />,
              onSelect: () => fileInputRef.current?.click(),
            },
            ...(entryId
              ? [
                  {
                    id: 'ferment',
                    label: pickled ? t('pickled') : t('ferment_title'),
                    icon: <FermentIcon />,
                    busy: pickling,
                    disabledReason: pickled ? t('pickled') : undefined,
                    onSelect: handlePickle,
                  },
                  {
                    id: 'delete',
                    label: t('delete'),
                    icon: <TrashIcon />,
                    tone: 'danger' as const,
                    onSelect: () => setDeleteOpen(true),
                  },
                ]
              : []),
          ]}
        />,
        chrome.paletteSlot,
      )}

      {/* 上段の右端に、この画面の設定（本文の見た目）。席が無ければ（孤立検証）出さない。 */}
      {chrome.actionSlot
        ? placeInSlot(
            <RoundButton ariaLabel={t('settings_title')} onClick={() => setSettingsOpen(true)}>
              <GearIcon />
            </RoundButton>,
            chrome.actionSlot,
          )
        : null}
      <SpEditorSettingsSheet
        open={settingsOpen}
        display={display}
        onChange={updateDisplay}
        onClose={() => setSettingsOpen(false)}
      />

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
