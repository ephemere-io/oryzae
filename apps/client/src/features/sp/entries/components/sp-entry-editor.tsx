'use client';

import { ACCEPTED_IMAGE_MIME_TYPES, type EditorEffectsState } from '@oryzae/shared';
import { verifyAttrs } from '@oryzae/verify';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionPalette, type PaletteAction } from '@/components/ui/action-palette';
import type { DockDetent } from '@/components/ui/dock-sheet';
import {
  AlignIcon,
  CheckIcon,
  FermentIcon,
  LetterIcon,
  PhotoIcon,
  TrashIcon,
  WrapIcon,
} from '@/components/ui/palette-icons';
import { PhotoStrip } from '@/components/ui/photo-strip';
import { GearIcon, RoundButton } from '@/components/ui/round-button';
import { CONTROL_FONT } from '@/components/ui/surface';
import {
  DEFAULT_MIN_CREATE_CHARS,
  useAutosaveEntry,
} from '@/features/shared/entries/hooks/use-autosave-entry';
import { useDeleteEntry } from '@/features/shared/entries/hooks/use-delete-entry';
import {
  SP_EDITOR_TYPOGRAPHY,
  useEditorDisplay,
} from '@/features/shared/entries/hooks/use-editor-display';
import { useSaveEntry } from '@/features/shared/entries/hooks/use-entry';
import { useEntryDraft } from '@/features/shared/entries/hooks/use-entry-draft';
import {
  clearEntryLocalCopy,
  readEntryLocalCopy,
  useEntryLocalCopy,
} from '@/features/shared/entries/hooks/use-entry-local-copy';
import { usePhotoImport } from '@/features/shared/entries/hooks/use-photo-import';
import type { AttachedPhoto, EntryDraft, InlinePhoto } from '@/features/shared/entries/types';
import {
  buildEffectsWithPhotos,
  photoOffsets,
  restoreInlinePhotos,
  toInlinePhoto,
  trimOrphanPlaceholders,
} from '@/features/shared/entries/utils/inline-photos';
import { QuestionPicker } from '@/features/shared/entry-questions/components/question-picker';
import {
  useActiveQuestions,
  useEntryQuestions,
} from '@/features/shared/entry-questions/hooks/use-entry-questions';
import type { LinkedQuestion } from '@/features/shared/entry-questions/types';
import { useFermentationDetails } from '@/features/shared/fermentation/hooks/use-fermentation-details';
import { useFermentationHistory } from '@/features/shared/fermentation/hooks/use-fermentation-history';
import { useCreateQuestion } from '@/features/shared/questions/hooks/use-create-question';
import type { ApiClient } from '@/lib/api';
import {
  placeInSlot,
  useSpBackHandler,
  useSpChrome,
  useSpHeading,
  useSpStatus,
} from '@/lib/sp-chrome-context';
import { useOnlineStatus } from '@/lib/use-online-status';
import { SpBodyEditor, type SpBodyEditorHandle, type SpBodySnapshot } from './sp-body-editor';
import { SpConfirmSheet } from './sp-confirm-sheet';
import { SpEditorSettingsSheet } from './sp-editor-settings-sheet';
import { SpFermentationDock } from './sp-fermentation-dock';
import { SpPhotoImportSheet } from './sp-photo-import-sheet';

interface SpEntryEditorProps {
  api: ApiClient | null;
  /** 問い一覧から「この問いで書く」で遷移してきた場合の初期問い。 */
  initialQuestionId?: string | null;
  /** 既存エントリを開く場合の id（自動保存が更新に切り替わる）。 */
  initialEntryId?: string;
  /** 既存エントリ本文（タイトル/本文を分けて初期化する）。 */
  initialContent?: string;
  /** 保存された装飾と本文の中の写真（PC と同じ形式）。SP は写真の位置だけを使い、他は持ち越す。 */
  initialEffects?: EditorEffectsState | null;
  /** サーバーの最終更新（ISO）。端末の写しがこれより新しければ写しから始める。 */
  initialUpdatedAt?: string;
  /** 既に瓶に漬けてあるか（開き直したエントリー）。 */
  initialFermentationEnabled?: boolean;
  /** 既存エントリに添えられた写真のストレージパス。 */
  initialMediaUrls?: string[];
  /** 表示用の署名付き URL（`initialMediaUrls` と同じ順・同じ数）。 */
  initialMediaSignedUrls?: string[];
  /** ドラフト（localStorage）に退避/復元するか。verify などで無効化する。 */
  persistDraft?: boolean;
}

/** 先頭行をタイトル、残りを本文として分割する（保存形式と対応）。 */
function splitTitleBody(raw: string): { title: string; body: string } {
  const idx = raw.indexOf('\n');
  if (idx === -1) return { title: '', body: raw };
  return { title: raw.slice(0, idx), body: raw.slice(idx + 1) };
}

/** 保存形式（先頭行＝タイトル）。 */
function composeContent(title: string, body: string): string {
  return title.trim() ? `${title.trim()}\n${body}` : body;
}

/**
 * SP「書く」画面。縦長・フォーカスで書き始められることを最優先にする。
 *
 * 本文は PC と同じ土台の contentEditable（`SpBodyEditor`）。写真は本文の中のカーソル位置に入り、
 * 文字が回り込み、指で掴んで動かせる。保存形式は PC と同じ（U+FFFC + `effects.inlineImages`）。
 * 結んだ問いの発酵の結果は本文の下の非モーダルのドック（`SpFermentationDock`）で
 * 「見ながら書く」。電波が無ければ端末の写しに残し、戻ったら送る。
 */
export function SpEntryEditor({
  api,
  initialQuestionId = null,
  initialEntryId,
  initialContent = '',
  initialEffects = null,
  initialUpdatedAt,
  initialFermentationEnabled = false,
  initialMediaUrls,
  initialMediaSignedUrls,
  persistDraft = true,
}: SpEntryEditorProps) {
  const t = useTranslations('sp.editor');
  const tDelete = useTranslations('entries.delete_modal');
  const tPhoto = useTranslations('photo');
  const tNav = useTranslations('sp.nav');
  const tSidebar = useTranslations('editor.fermentation_sidebar');
  const router = useRouter();
  const { deleteEntry, deleting } = useDeleteEntry(api);
  const { save, saving, error } = useSaveEntry(api, null);
  const activeQuestions = useActiveQuestions(api, false);
  const { load: loadDraft, save: saveDraft, clear: clearDraft } = useEntryDraft();
  const online = useOnlineStatus();

  // ドラフト退避/復元は「素の新規フロー」だけで行う（既存編集・問い返信は対象外）。
  const draftEnabled = persistDraft && !initialEntryId && !initialQuestionId;
  // マウント時に一度だけ、新鮮なドラフトがあれば書きかけを復元する（+ 押し直しでの再開）。
  const [restored] = useState<EntryDraft | null>(() => (draftEnabled ? loadDraft() : null));

  /**
   * 端末の写し（オフラインの保険）。既存エントリで、サーバーの内容より新しく中身が違えば、
   * 写しから始めて自動保存に送らせる（電波が戻る前に閉じても続きから）。
   */
  const [localCopy] = useState(() => {
    if (!initialEntryId || !persistDraft) return null;
    const copy = readEntryLocalCopy(initialEntryId);
    if (!copy || copy.content === initialContent) return null;
    if (initialUpdatedAt && copy.updatedAt <= Date.parse(initialUpdatedAt)) return null;
    return copy;
  });

  /** 添えた写真（保存順 = mediaUrls）。パスと表示 URL を 1 本の配列で持つ（署名失敗で index がずれないように）。 */
  // 試作: `?sheet=vaul` で板の土台を Vaul に差し替える（開いたときに一度だけ読む）。
  const [sheetEngine] = useState<'snap' | 'vaul'>(() =>
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('sheet') === 'vaul'
      ? 'vaul'
      : 'snap',
  );
  const [photos, setPhotos] = useState<AttachedPhoto[]>(() => {
    const paths = localCopy?.mediaUrls ?? initialMediaUrls ?? [];
    const signedByPath = new Map(
      (initialMediaUrls ?? []).map((path, i) => [path, initialMediaSignedUrls?.[i] ?? '']),
    );
    return paths.map((storagePath) => ({
      storagePath,
      signedUrl: signedByPath.get(storagePath) ?? '',
    }));
  });

  // 既存エントリ編集なら content を タイトル/本文 に割って初期化（autosave は entryId 有りで更新）。
  // 本文の中の写真は effects から復元し、対応の無いプレースホルダは落とす。
  // **写しがあっても、まずサーバーの内容で始める**: 自動保存は最初の内容を「保存済み」の基準にするので、
  // 写しを最初から入れると差が無いと見なされて送られない。写しは下の effect で入れ替える。
  const [initial] = useState(() => {
    if (initialEntryId) {
      const split = splitTitleBody(initialContent);
      const { body, images } = restoreInlinePhotos(split.body, initialEffects, photos);
      return { title: split.title, body, images };
    }
    if (restored) {
      return {
        title: restored.title,
        body: restoreInlinePhotos(restored.body, null, []).body,
        images: [],
      };
    }
    return { title: '', body: initialContent, images: [] };
  });
  const resolvedEntryId = initialEntryId ?? restored?.entryId;
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  /** 本文の中の写真（置き順、見た目つき）。数は本文のプレースホルダの数と同じ。 */
  const [inlinePhotos, setInlinePhotos] = useState<InlinePhoto[]>(initial.images);
  /** 選んでいる写真（パレットが写真の操作に切り替わる）。 */
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null);
  const [entryId, setEntryId] = useState<string | undefined>(resolvedEntryId);
  // サーバ保存済み（entryId あり）なら保存済み表示、未保存の復元ドラフトは「編集中」表示にする。
  const [lastSavedBody, setLastSavedBody] = useState(resolvedEntryId ? initial.body : '');
  const [lastSavedTitle, setLastSavedTitle] = useState(resolvedEntryId ? initial.title.trim() : '');
  const bodyEditorRef = useRef<SpBodyEditorHandle | null>(null);
  // 端末の写しがサーバーより新しければ、それに入れ替える（差ができるので自動保存が送る）。
  // biome-ignore lint/correctness/useExhaustiveDependencies: マウント時に一度だけ入れ替える（写しは開いた時点のもの）
  useEffect(() => {
    if (!localCopy) return;
    const split = splitTitleBody(localCopy.content);
    // 写しは見た目を持たない。サーバーの effects に同じ写真があればその見た目、無ければ既定。
    const known = new Map(initial.images.map((image) => [image.storagePath, image]));
    const images = localCopy.inlinePaths.map(
      (storagePath) =>
        known.get(storagePath) ??
        toInlinePhoto({
          storagePath,
          signedUrl: photos.find((photo) => photo.storagePath === storagePath)?.signedUrl ?? '',
        }),
    );
    const nextBody = trimOrphanPlaceholders(split.body, images.length);
    setTitle(split.title);
    // 本文の DOM を入れ替える（本文と写真の state は、入れ替えの知らせで揃う）。
    bodyEditorRef.current?.setContent(nextBody, images.slice(0, photoOffsets(nextBody).length));
  }, []);
  const [pickling, setPickling] = useState(false);
  /**
   * 瓶に漬けてあるか。「漬け込む」はエントリーに印を付けるだけで、発酵は日に 1 回の見回りが**その時点の
   * 本文で**行う。だから押したあとの書き足しも一緒に漬かる（押し直しは要らない）。それを画面で言う。
   */
  const [pickled, setPickled] = useState(initialFermentationEnabled);
  /** いま押したところか。次に書き足すまで、上段の状態で「瓶に漬けました」と言う。 */
  const [justPickled, setJustPickled] = useState(false);
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
  /**
   * 題が上段の下に隠れているか。隠れている間だけ、上段の中央に題を出す（Notion のモバイル:
   * 本文をスクロールすると見出しが上段に上がり、題が全部見えると消える）。
   * 見張るのは殻の本文（`main`）の中での見え方。殻が無い場所（孤立検証）では窓に対して。
   */
  const titleRef = useRef<HTMLInputElement>(null);
  const [titleHidden, setTitleHidden] = useState(false);
  useEffect(() => {
    const element = titleRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (entry) setTitleHidden(entry.intersectionRatio < 1);
      },
      { root: element.closest('main'), threshold: [1] },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useSpHeading(titleHidden && title.trim() ? title.trim() : null);
  const bodyStyle = {
    fontFamily: SP_EDITOR_TYPOGRAPHY.fontFamily[display.fontFamily],
    fontSize: SP_EDITOR_TYPOGRAPHY.fontSize[display.fontSize],
    lineHeight: SP_EDITOR_TYPOGRAPHY.lineHeight[display.lineHeight],
    letterSpacing: SP_EDITOR_TYPOGRAPHY.letterSpacing[display.letterSpacing],
  };
  const [deleteOpen, setDeleteOpen] = useState(false);

  const mediaUrls = useMemo(() => photos.map((p) => p.storagePath), [photos]);
  /** PC と同じ理由の鏡。await をまたぐ連続操作で古い配列を送らないため。 */
  const photosRef = useRef<AttachedPhoto[]>(photos);
  photosRef.current = photos;
  const inlineRef = useRef<InlinePhoto[]>(inlinePhotos);
  inlineRef.current = inlinePhotos;
  const bodyTextRef = useRef(body);
  bodyTextRef.current = body;
  const inlinePaths = useMemo(() => inlinePhotos.map((p) => p.storagePath), [inlinePhotos]);
  /** 本文の中に居ない写真（PC の旧形式・添付だけ）。今までどおり本文の下に積む。 */
  const loosePhotos = useMemo(
    () => photos.filter((photo) => !inlinePaths.includes(photo.storagePath)),
    [photos, inlinePaths],
  );

  /**
   * 保存は必ず effects（本文の中の写真の位置）を添える。自動保存も明示の保存も同じ口を通る。
   * PC の装飾（textSpans 等）は `initialEffects` から持ち越す。
   */
  const saveWithEffects = useCallback(
    (
      content: string,
      id?: string,
      options?: { mediaUrls?: string[]; fermentationEnabled?: boolean },
    ) =>
      save(content, id, {
        ...options,
        effects: buildEffectsWithPhotos(bodyTextRef.current, inlineRef.current, initialEffects),
      }),
    [save, initialEffects],
  );

  // Issue #314: 問いが1つも無いと、シートが「ありません」を出すだけで手詰まりだった。
  // その場で問いを立てられるようにする（PC は #316 の QuestionSelectModal で既に可能）。
  const createQuestion = useCreateQuestion(api);
  // 「書く」に切り替えたい意思だけを持ち、モードは activeQuestions から導出する。
  const [composeRequested, setComposeRequested] = useState(false);
  // 作りたての問いは activeQuestions にも linkedQuestions にも即座には現れない。ここで覚えておく。
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

  const { retrying } = useAutosaveEntry({
    title,
    body,
    entryId,
    save: saveWithEffects,
    mediaUrls,
    onSaved: (id, savedBody, savedTitle) => {
      setEntryId(id);
      setLastSavedBody(savedBody);
      setLastSavedTitle(savedTitle);
    },
    enabled: api != null,
  });

  // 端末の写し: サーバーに届いていない間だけ置き、届いたら消す（id のあるエントリ）。
  useEntryLocalCopy({
    entryId: persistDraft ? entryId : undefined,
    content: composeContent(title, body),
    mediaUrls,
    inlinePaths,
    savedContent: composeContent(lastSavedTitle, lastSavedBody),
  });

  /**
   * 本文が変わった（書いた・写真を置いた／動かした／抜いた）。本文と写真の state を揃える。
   * 本文から消えた写真（BackSpace で消した等）は、添えた写真からも外す（本文の下に積み直さない）。
   */
  const handleBodyChange = useCallback((snapshot: SpBodySnapshot) => {
    const gone = inlineRef.current.filter(
      (before) => !snapshot.images.some((image) => image.storagePath === before.storagePath),
    );
    bodyTextRef.current = snapshot.body;
    inlineRef.current = snapshot.images;
    setBody(snapshot.body);
    setInlinePhotos(snapshot.images);
    setSelectedPhoto((index) => (index !== null && index >= snapshot.images.length ? null : index));
    if (gone.length === 0) return;
    const nextPhotos = photosRef.current.filter(
      (photo) => !gone.some((image) => image.storagePath === photo.storagePath),
    );
    photosRef.current = nextPhotos;
    setPhotos(nextPhotos);
  }, []);

  /** 起こした文字をカーソル位置に差し込む（本文の全置換はしない）。 */
  function insertAtCursor(text: string) {
    bodyEditorRef.current?.insertText(text);
  }

  /**
   * 写真を**いまのカーソル位置**に置く（Notion のモバイルと同じ）。カーソルは写真の直後へ。
   * 本文が未保存でも写真だけ先に確定させたいので、ここで明示的に保存する。
   */
  async function attachPhoto(photo: AttachedPhoto) {
    const nextPhotos = [...photosRef.current, photo];
    photosRef.current = nextPhotos;
    setPhotos(nextPhotos);
    const nextBody =
      bodyEditorRef.current?.insertPhoto(toInlinePhoto(photo)).body ?? bodyTextRef.current;

    const content = composeContent(title, nextBody);
    if (!content.trim()) return; // 本文が空のうちは保存できない。次の保存で一緒に載る。
    const saved = await saveWithEffects(content, entryId, {
      mediaUrls: nextPhotos.map((p) => p.storagePath),
    });
    if (saved) {
      setEntryId(saved);
      setLastSavedBody(nextBody);
      setLastSavedTitle(title.trim());
    }
  }

  /** 本文の中の写真を抜く（添付ごと。添えた写真の一覧は本文の変化の知らせで揃う）。 */
  async function removeInlinePhoto(index: number) {
    if (!inlineRef.current[index]) return;
    const nextBody = bodyEditorRef.current?.removeImage(index).body ?? bodyTextRef.current;
    const content = composeContent(title, nextBody);
    if (!entryId || !content.trim()) return;
    const saved = await saveWithEffects(content, entryId, {
      mediaUrls: photosRef.current.map((p) => p.storagePath),
    });
    if (saved) {
      setLastSavedBody(nextBody);
      setLastSavedTitle(title.trim());
    }
  }

  /**
   * 選んでいる写真の見た目を変える（幅・寄せ・回り込み）。値は PC と同じ `InlineImage` の語彙。
   * すぐ保存する（自動保存は本文の変化しか見ていない）。
   */
  async function updateSelectedPhoto(
    patch: Partial<Pick<InlinePhoto, 'widthRatio' | 'layout' | 'align'>>,
  ) {
    if (selectedPhoto === null) return;
    bodyEditorRef.current?.updateImage(selectedPhoto, patch);
    const content = composeContent(title, bodyTextRef.current);
    if (!entryId || !content.trim()) return;
    await saveWithEffects(content, entryId, { mediaUrls });
  }

  /** 本文の下に積んである（本文の中に居ない）写真を外す。 */
  async function removeLoosePhoto(index: number) {
    const target = loosePhotos[index];
    if (!target) return;
    const nextPhotos = photosRef.current.filter((p) => p.storagePath !== target.storagePath);
    photosRef.current = nextPhotos;
    setPhotos(nextPhotos);
    const content = composeContent(title, body);
    if (!entryId || !content.trim()) return;
    await saveWithEffects(content, entryId, { mediaUrls: nextPhotos.map((p) => p.storagePath) });
  }

  const photoImport = usePhotoImport({
    api,
    onAttach: attachPhoto,
    onInsertText: insertAtCursor,
  });

  // 問いはエントリ作成後（entryId 確定後）に一度だけ紐づける。
  const linkAttemptedRef = useRef(new Set<string>());

  // Issue #448: 既存エントリを一覧から開くと、紐づいている問いがチップに出ていなかった。
  const questionSeededRef = useRef(false);
  useEffect(() => {
    if (questionSeededRef.current) return;
    if (linkedQuestions.length === 0) return;
    questionSeededRef.current = true;
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
  // 電波が無い（または送れず再送待ち）の間は「端末に保存」と言う。書いたものは写しに残っている。
  const offlineHold = dirty && (!online || retrying);
  const statusText = saving
    ? t('status_saving')
    : !hasBody
      ? ''
      : offlineHold
        ? t('status_offline')
        : dirty
          ? t('status_editing')
          : t('status_saved');
  // 状態は上段（SpTopBar）の中央へ。発酵を始めたらそれを最優先で言う。
  const chrome = useSpChrome();
  // 押した直後だけ「瓶に漬けました」。書き足せば保存の状態に戻る（漬けてあることは題の下の行が言い続ける）。
  useEffect(() => {
    if (dirty) setJustPickled(false);
  }, [dirty]);
  useSpStatus(
    error ?? (justPickled ? t('pickled') : statusText),
    error ? 'error' : saving || offlineHold ? 'saving' : 'ok',
  );

  // 紐付け済みの問いが終了（アーカイブ）されていると activeQuestions に載らない。
  const selectedQuestions: LinkedQuestion[] = selectedQuestionIds.map(
    (id) =>
      activeQuestions.find((q) => q.id === id) ??
      linkedQuestions.find((q) => q.id === id) ??
      createdQuestions.find((q) => q.id === id) ?? { id, currentText: null },
  );

  // 選べる問いが無ければ入力欄、あれば一覧。取得が遅れて届いても自動で一覧に切り替わる。
  const composingQuestion = composeRequested || activeQuestions.length === 0;

  function openQuestionPicker() {
    setComposeRequested(false);
    setPickerOpen(true);
  }
  const closePicker = useCallback(() => setPickerOpen(false), []);
  // 開いている間は、上段の戻るが選び手を閉じる（書斎へは戻らない）。
  useSpBackHandler(pickerOpen ? closePicker : null);

  /** 問いを結ぶ／外す。**複数結べる**（PC と同じ）。 */
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

  async function handleCreateQuestion(text: string): Promise<string | null> {
    const id = await createQuestion(text);
    if (!id) return null;
    setCreatedQuestions((prev) => [...prev, { id, currentText: text }]);
    setSelectedQuestionIds((previous) => [...previous, id]);
    setComposeRequested(false);
    return id;
  }

  /**
   * 発酵の結果。**どの問いの・いつの**結果かを選べる（結んだ問いが複数でも、発酵が何回あっても）。
   * 以前は結んだ最初の問いの最新の 1 回しか見られなかった（レビュー）。
   *
   * **見ながら書く**: 本文の下の非モーダルのドック。問いを結ぶ前から出し、結ぶと何が出るかを言う。
   * 書いている間（キーボードが出ている間）は出さず、覗く段を押せばフォーカスを外して半分へ（読む）。
   */
  const { byQuestion: fermentationsByQuestion, loading: historyLoading } = useFermentationHistory(
    api,
    false,
  );
  const [resultQuestionPick, setResultQuestionPick] = useState<string | null>(null);
  const resultQuestionId =
    resultQuestionPick && selectedQuestionIds.includes(resultQuestionPick)
      ? resultQuestionPick
      : (selectedQuestionIds[0] ?? null);
  const resultRounds = useMemo(
    () =>
      [...(resultQuestionId ? (fermentationsByQuestion.get(resultQuestionId) ?? []) : [])]
        .reverse()
        .map((summary) => ({ id: summary.id, createdAt: summary.createdAt })),
    [fermentationsByQuestion, resultQuestionId],
  );
  const [resultRoundPick, setResultRoundPick] = useState<string | null>(null);
  const resultRoundId =
    resultRoundPick && resultRounds.some((round) => round.id === resultRoundPick)
      ? resultRoundPick
      : (resultRounds[0]?.id ?? null);
  const resultDetailIds = useMemo(() => (resultRoundId ? [resultRoundId] : []), [resultRoundId]);
  const { details: fermentationDetails, loading: detailsLoading } = useFermentationDetails(
    api,
    resultDetailIds,
  );
  const fermentationDetail = resultRoundId
    ? (fermentationDetails.get(resultRoundId) ?? null)
    : null;
  const fermentationLoading =
    resultQuestionId !== null &&
    (historyLoading ||
      (resultRoundId !== null && !fermentationDetails.has(resultRoundId) && detailsLoading));
  const [resultOpen, setResultOpen] = useState(true);
  const [resultDetent, setResultDetent] = useState<DockDetent>('peek');
  // 設定や問いの選び手を開いたときは覗く段へ（結果の半分が重なると、設定の段や選び手が隠れた）。
  useEffect(() => {
    if (settingsOpen || pickerOpen) setResultDetent('peek');
  }, [settingsOpen, pickerOpen]);
  /**
   * 見えているか。**キーボードが出ている間は出さない**（書こうとすると結果が被さってきて打ちづらい、
   * とレビュー）。キーボードを閉じれば覗く段で戻る。出したいときはパレットの「発酵の結果」
   * （押すとキーボードを閉じて半分で出す）。
   */
  const resultVisible = resultOpen && !chrome.keyboardOpen;
  const wasKeyboardOpen = useRef(false);
  useEffect(() => {
    if (chrome.keyboardOpen) wasKeyboardOpen.current = true;
    else if (wasKeyboardOpen.current) {
      wasKeyboardOpen.current = false;
      setResultDetent('peek');
    }
  }, [chrome.keyboardOpen]);
  const blurEditor = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) active.blur();
  }, []);
  // 出ていれば消す、消えていれば半分で出す。段の切り替えはつまみと指に任せる（ボタンは 1 つの意味だけ）。
  const toggleResult = useCallback(() => {
    if (resultVisible) {
      setResultOpen(false);
      return;
    }
    setResultOpen(true);
    blurEditor();
    setResultDetent('half');
  }, [resultVisible, blurEditor]);

  /**
   * 「漬け込む」は最初から並べる（実機レビュー: 最初からパレットにあってよい）。書く前（自動保存がエントリーを
   * 作れる文字数に届く前）は押せず、押すと理由が出る。書いたあと、自動保存がエントリーを作り終える前に押したら、
   * 作り終えるのを待ってから漬ける（押したのに何も起きない、にしない）。
   */
  const canPickle = composeContent(title, body).trim().length >= DEFAULT_MIN_CREATE_CHARS;
  const [pickleRequested, setPickleRequested] = useState(false);
  async function handlePickle() {
    if (pickling || pickled || !canPickle) return;
    // Issue #450: 問いに紐づいていないエントリは発酵ループに入らない。先に問いを決めてもらう。
    if (selectedQuestionIds.length === 0) {
      openQuestionPicker();
      return;
    }
    if (!entryId) {
      setPickleRequested(true);
      return;
    }
    setPickleRequested(false);
    setPickling(true);
    const saved = await saveWithEffects(composeContent(title, body), entryId, {
      fermentationEnabled: true,
      mediaUrls,
    });
    setPickling(false);
    if (saved) {
      setPickled(true);
      setJustPickled(true);
      clearDraft(); // 発酵させたら確定。書きかけドラフトは破棄する。
    }
  }

  const handlePickleRef = useRef(handlePickle);
  handlePickleRef.current = handlePickle;
  useEffect(() => {
    if (pickleRequested && entryId) void handlePickleRef.current();
  }, [pickleRequested, entryId]);

  // 確認シートで「削除する」→ API 削除が成功したら書斎へ戻る。
  async function handleDelete() {
    if (!entryId) return;
    const ok = await deleteEntry(entryId);
    if (ok) {
      clearDraft();
      clearEntryLocalCopy(entryId);
      // SP に一覧の画面は無い（一覧は書斎の手帳から開く）。消したら書斎へ。
      router.push('/');
    } else {
      setDeleteOpen(false);
    }
  }

  const selected = selectedPhoto === null ? null : (inlinePhotos[selectedPhoto] ?? null);
  const widthLabel = (ratio: number) =>
    ratio <= 0.45
      ? t('photo_width_small')
      : ratio <= 0.75
        ? t('photo_width_medium')
        : t('photo_width_large');
  const nextWidth = (ratio: number) => (ratio <= 0.45 ? 0.7 : ratio <= 0.75 ? 1 : 0.4);
  const alignLabel = (align: InlinePhoto['align']) =>
    align === 'center'
      ? tPhoto('align_center')
      : align === 'end'
        ? tPhoto('align_end')
        : tPhoto('align_start');
  // 回り込みは左右どちらかに寄せる（中央は文字が流れる側が無い）。それ以外は 左→中央→右。
  const nextAlign = (photo: InlinePhoto): InlinePhoto['align'] =>
    photo.layout === 'wrap'
      ? photo.align === 'end'
        ? 'start'
        : 'end'
      : photo.align === 'start'
        ? 'center'
        : photo.align === 'center'
          ? 'end'
          : 'start';
  /**
   * 写真を選んでいる間のパレット。押すたびに値が巡る（幅 小→中→大、寄せ 左→中央→右）。
   * 回り込みは PC と同じ `layout: 'wrap'`（float。文字が写真の横を流れる）。位置は写真を掴んで動かす。
   */
  const photoActions: PaletteAction[] = selected
    ? [
        {
          id: 'photo-width',
          label: `${t('photo_width')} ${widthLabel(selected.widthRatio)}`,
          caption: `${t('photo_width')} · ${widthLabel(selected.widthRatio)}`,
          icon: <PhotoIcon />,
          onSelect: () => void updateSelectedPhoto({ widthRatio: nextWidth(selected.widthRatio) }),
        },
        {
          id: 'photo-align',
          label: `${t('photo_align')} ${alignLabel(selected.align)}`,
          caption: `${t('photo_align')} · ${alignLabel(selected.align)}`,
          icon: <AlignIcon align={selected.align} />,
          disabledReason: selected.widthRatio >= 1 ? t('photo_width_large') : undefined,
          onSelect: () => void updateSelectedPhoto({ align: nextAlign(selected) }),
        },
        {
          id: 'photo-wrap',
          label: `${t('photo_wrap')} ${selected.layout === 'wrap' ? t('photo_wrap_on') : t('photo_wrap_off')}`,
          caption: `${t('photo_wrap')} · ${selected.layout === 'wrap' ? t('photo_wrap_on') : t('photo_wrap_off')}`,
          icon: <WrapIcon />,
          active: selected.layout === 'wrap',
          onSelect: () =>
            void updateSelectedPhoto({
              layout: selected.layout === 'wrap' ? 'block' : 'wrap',
              // 中央寄せのまま回り込みにすると左に寄る。見た目と表示を揃えて左にする。
              ...(selected.layout !== 'wrap' && selected.align === 'center'
                ? { align: 'start' as const }
                : {}),
              // 回り込みは幅いっぱいでは成立しない。全幅なら半分に。
              ...(selected.layout !== 'wrap' && selected.widthRatio >= 1
                ? { widthRatio: 0.4 }
                : {}),
            }),
        },
        {
          id: 'photo-remove',
          label: t('photo_remove'),
          icon: <TrashIcon />,
          tone: 'danger' as const,
          onSelect: () => {
            const index = selectedPhoto;
            setSelectedPhoto(null);
            if (index !== null) void removeInlinePhoto(index);
          },
        },
        {
          id: 'photo-done',
          label: t('photo_done'),
          icon: <CheckIcon />,
          onSelect: () => setSelectedPhoto(null),
        },
      ]
    : [];

  const paletteActions: PaletteAction[] = [
    {
      id: 'photo',
      label: tPhoto('toolbar_button'),
      icon: <PhotoIcon />,
      onSelect: () => {},
      // 押した指がそのまま選び手の input に当たる（iOS のメニューがボタンから出る）。
      file: {
        accept: ACCEPTED_IMAGE_MIME_TYPES.join(','),
        onFile: (file) => void photoImport.selectFile(file),
      },
    },
    {
      id: 'ferment',
      // PC と同じ語（「瓶に納めて発酵させる」は列に長すぎた）。漬けた後は「漬けてある」（「発酵中」は
      // いま発酵しているように読め、書き足したら押し直すのかが分からなかった。実機レビュー）。
      label: pickled ? t('ferment_done_short') : t('ferment_title'),
      icon: <FermentIcon />,
      busy: pickling || pickleRequested,
      active: pickled,
      disabledReason: pickled
        ? t('pickled_note')
        : !canPickle
          ? t('ferment_needs_body')
          : undefined,
      onSelect: () => void handlePickle(),
    },
    // 問いを結ぶ前から出す（押すと、結ぶと何が出るかと、結ぶ入口が出る）。
    {
      id: 'result',
      label: tSidebar('heading'),
      icon: <LetterIcon />,
      active: resultVisible,
      onSelect: toggleResult,
    },
  ];

  const gear = (
    // 押すたびに開く／閉じる（開いている間に押したら閉じる。実機レビュー）。
    <RoundButton ariaLabel={t('settings_title')} onClick={() => setSettingsOpen((value) => !value)}>
      <GearIcon />
    </RoundButton>
  );

  return (
    <div
      // 高さは中身で決める（min-h-full）。本文が伸びれば殻の本文（main）がスクロールし、題が上段の下へ
      // 隠れて見出しが上がる。h-full だと textarea の中だけがスクロールして、題は永遠に見えたまま。
      className="relative flex min-h-full flex-col bg-[var(--bg)] text-[var(--fg)]"
      {...verifyAttrs({
        unit: 'SpEntryEditor',
        hasBody,
        dirty,
        hasEntry: !!entryId,
        hasQuestion: selectedQuestionIds.length > 0,
        pickerOpen,
        composingQuestion,
        pickling,
        deleteOpen,
        settingsOpen,
        offline: offlineHold,
        inlinePhotoCount: inlinePhotos.length,
        selectedPhoto: selectedPhoto ?? 'none',
        hasFermentation: fermentationDetail !== null,
        resultOpen: resultVisible,
        resultDetent,
      })}
    >
      {/* 保存の状態は上段（SpTopBar）の中央に出す。上段が無い場所（孤立検証・テスト）では
          ここに小さく出す。 */}
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
        ref={titleRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('title_placeholder')}
        aria-label={t('title_placeholder')}
        className="w-full bg-transparent px-6 pt-3 text-2xl font-medium leading-snug outline-none placeholder:opacity-25"
        style={{ fontFamily: bodyStyle.fontFamily, letterSpacing: bodyStyle.letterSpacing }}
      />

      {/* 結んでいる問い。題の下の行（Notion の見出し下のプロパティと同じ席）。複数結べる。× で外す。 */}
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
      {/* 問いを結ぶ選び手は、押した行（結んだ問いと「問いを結ぶ」）のすぐ下に開く（オーナーの指示）。 */}
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
      {/* 漬けてあること。書き足したら押し直すのか、に答える 1 行（結んだ問いの下）。 */}
      {pickled ? (
        <p
          data-pickled-note
          className="mx-6 mt-1.5 flex items-start gap-2 text-[12px] leading-relaxed"
          style={{ ...CONTROL_FONT, color: 'var(--date-color)' }}
        >
          <span
            aria-hidden="true"
            className="mt-[0.55em] inline-block h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: 'var(--accent)' }}
          />
          <span>{t('pickled_note')}</span>
        </p>
      ) : null}
      {/* 本文。結んだ問いの行との間は行 1 つぶん（広く空けると問いと本文が別物に見えた。実機レビュー）。
          写真は本文の中。 */}
      <div className="mt-3">
        <SpBodyEditor
          ref={bodyEditorRef}
          initialBody={initial.body}
          initialImages={initial.images}
          onChange={handleBodyChange}
          selectedImage={selectedPhoto}
          onSelectImage={setSelectedPhoto}
          placeholder={t('body_placeholder')}
          ariaLabel={t('body_placeholder')}
          style={bodyStyle}
          autoFocus
        />
      </div>

      {/* 本文の中に居ない写真（旧形式）。本文の下に全幅で積む。 */}
      <PhotoStrip
        urls={loosePhotos.map((p) => p.signedUrl)}
        onRemove={(index) => void removeLoosePhoto(index)}
        variant="blocks"
      />

      <SpPhotoImportSheet
        state={photoImport.state}
        onTranscribe={photoImport.transcribe}
        onAttach={photoImport.attach}
        onInsertTranscript={photoImport.insertTranscript}
        onDiscardTranscript={photoImport.discardTranscript}
        onClose={() => {
          photoImport.close();
          // 写真の選択で iOS はキーボードを閉じる。やめたら元のカーソルへ戻す。
          bodyEditorRef.current?.focus();
        }}
      />

      {/* 操作は殻の下端の列に集める（キーボードが出ればその真上）。問いを結ぶのは題の下の行が担う。
          発酵は保存済み（entryId 確定後）のときだけ並ぶ。**削除は並べない**（書いている最中に
          何度も押す手の列に、取り返しのつかない操作を置かない）。設定シートの末尾にある。 */}
      {placeInSlot(
        <ActionPalette
          ariaLabel={t('palette_aria')}
          keyboardOpen={chrome.keyboardOpen}
          dismissKeyboardLabel={tNav('dismiss_keyboard')}
          actions={selected ? photoActions : paletteActions}
        />,
        chrome.paletteSlot,
      )}

      {/* 上段の右端に、この画面の設定（本文の見た目と、末尾に削除）。殻の外（孤立検証）ではその場に。 */}
      {chrome.mounted ? (chrome.actionSlot ? placeInSlot(gear, chrome.actionSlot) : null) : gear}
      <SpEditorSettingsSheet
        open={settingsOpen}
        display={display}
        onChange={updateDisplay}
        onClose={() => setSettingsOpen(false)}
        onDelete={
          entryId
            ? () => {
                setSettingsOpen(false);
                setDeleteOpen(true);
              }
            : undefined
        }
      />

      {/* 発酵の結果: 本文の下の非モーダルのドック（見ながら書く）。 */}
      <SpFermentationDock
        engine={sheetEngine}
        open={resultVisible}
        detent={resultDetent}
        onDetentChange={setResultDetent}
        onPeekTap={blurEditor}
        questions={selectedQuestions.map((question) => ({
          id: question.id,
          text: question.currentText ?? t('question_untitled'),
        }))}
        questionId={resultQuestionId}
        onQuestionChange={(id) => {
          setResultQuestionPick(id);
          setResultRoundPick(null);
        }}
        rounds={resultRounds}
        roundId={resultRoundId}
        onRoundChange={setResultRoundPick}
        detail={fermentationDetail}
        loading={fermentationLoading}
        onLinkQuestion={() => {
          blurEditor();
          setResultDetent('peek');
          openQuestionPicker();
        }}
      />

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
