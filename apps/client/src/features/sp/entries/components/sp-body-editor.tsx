'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import {
  type CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from 'react';
import type { InlinePhoto } from '@/features/shared/entries/types';
import {
  applyInlineImageStyle,
  applyInlineImagesToEditor,
  createInlineImageElement,
  isInlineImage,
  readInlineImageFromElement,
  serializeEditorText,
} from '@/features/shared/entries/utils/inline-image-codec';
import { photoOffsets } from '@/features/shared/entries/utils/inline-photos';
import { caretRect, dropRangeAt, movePhotoTo } from '../utils/photo-drop';
import {
  liftToMiddle,
  revealRect,
  scrollContainerOf,
  scrollParent,
} from '../utils/reveal-in-scroller';

/** 本文の中身（保存形式の本文と、置き順の写真）。 */
export interface SpBodySnapshot {
  body: string;
  images: InlinePhoto[];
}

export interface SpBodyEditorHandle {
  /** いまのカーソル（無ければ最後に触った位置、それも無ければ末尾）に写真を置く。 */
  insertPhoto(photo: InlinePhoto): SpBodySnapshot;
  /** カーソルの位置に文字を差し込む。直前が改行でなければ改行を足す。 */
  insertText(text: string): SpBodySnapshot;
  /** 写真 `index`（置き順）の見た目を変える（幅・寄せ・回り込み）。 */
  updateImage(
    index: number,
    patch: Partial<Pick<InlinePhoto, 'widthRatio' | 'layout' | 'align'>>,
  ): SpBodySnapshot;
  /** 写真 `index` を抜く。 */
  removeImage(index: number): SpBodySnapshot;
  /** 中身を丸ごと入れ替える（端末の写しから始めるとき）。 */
  setContent(body: string, images: readonly InlinePhoto[]): SpBodySnapshot;
  /** 最後に触った位置へフォーカスを戻す。 */
  focus(): void;
}

interface SpBodyEditorProps {
  /** 開いたときの本文。写真の位置は U+FFFC。以後の中身は本文の DOM が持つ（`onChange` で知らせる）。 */
  initialBody: string;
  /** 開いたときの写真（置き順）。数は本文のプレースホルダの数と同じ。 */
  initialImages: readonly InlinePhoto[];
  onChange: (snapshot: SpBodySnapshot) => void;
  /** 選んでいる写真（縁取り。パレットが写真の操作に切り替わる。掴んで動かせる）。 */
  selectedImage: number | null;
  onSelectImage: (index: number | null) => void;
  placeholder: string;
  ariaLabel: string;
  /** 本文の見た目（書体・大きさ・行間・字間）。 */
  style: CSSProperties;
  autoFocus?: boolean;
}

/** `contenteditable="plaintext-only"` が使えるか（使えない古いブラウザは `true` にし、貼り付けを自前で文字に落とす）。 */
function editableMode(): 'plaintext-only' | 'true' {
  if (typeof document === 'undefined') return 'true';
  try {
    const probe = document.createElement('div');
    probe.contentEditable = 'plaintext-only';
    return probe.contentEditable === 'plaintext-only' ? 'plaintext-only' : 'true';
  } catch {
    return 'true';
  }
}

function photosIn(editor: HTMLElement): HTMLImageElement[] {
  return Array.from(editor.querySelectorAll('img')).filter(isInlineImage);
}

function toPhoto(el: HTMLImageElement): InlinePhoto {
  const image = readInlineImageFromElement(el);
  return {
    storagePath: image.storagePath,
    signedUrl: el.getAttribute('src') ?? '',
    widthRatio: image.widthRatio,
    layout: image.layout,
    align: image.align,
    ...(image.aspect ? { aspect: image.aspect } : {}),
  };
}

/** 本文の DOM を、保存形式の本文と写真から作り直す。 */
function renderInto(editor: HTMLElement, body: string, images: readonly InlinePhoto[]): void {
  editor.textContent = body;
  const offsets = photoOffsets(body);
  applyInlineImagesToEditor(
    editor,
    images.flatMap((photo, index) => {
      const offset = offsets[index];
      if (offset === undefined) return [];
      return [
        {
          offset,
          storagePath: photo.storagePath,
          widthRatio: photo.widthRatio,
          layout: photo.layout,
          align: photo.align,
          ...(photo.aspect ? { aspect: photo.aspect } : {}),
        },
      ];
    }),
    new Map(images.map((photo) => [photo.storagePath, photo.signedUrl])),
  );
}

/**
 * SP の本文。**PC と同じ土台の contentEditable**（写真は本文の中の `<img>`）。
 *
 * - 保存形式は PC と同じ（本文の U+FFFC + `effects.inlineImages`）。DOM との往復は PC と共有の
 *   `inline-image-codec.ts`。回り込みは `float`（論理方向）なので、文字は写真の横を流れる
 * - 写真を押すと選ばれ（縁取り）、パレットが写真の操作（幅・寄せ・回り込み・外す）に切り替わる
 * - **選んだ写真は指で掴んで動かせる**。離した点の文字の位置（`caretRangeFromPoint`）へ入れ直す。
 *   掴んでいる間は落とす先に縦線を出し、本文の上端・下端に寄せれば本文が送られる
 * - 中身の正は DOM（React で描かない。編集で書き換わる DOM と仮想 DOM が食い違うため）。
 *   変わるたびに `onChange` で本文と写真を知らせる。外からの変更は handle を通す
 */
export const SpBodyEditor = forwardRef<SpBodyEditorHandle, SpBodyEditorProps>(function SpBodyEditor(
  {
    initialBody,
    initialImages,
    onChange,
    selectedImage,
    onSelectImage,
    placeholder,
    ariaLabel,
    style,
    autoFocus,
  },
  ref,
) {
  const t = useTranslations('photo');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const ghostRef = useRef<HTMLImageElement | null>(null);
  /** 最後に本文の中にあったカーソル（シートや写真の選択でフォーカスが外れても、そこへ戻す）。 */
  const savedRangeRef = useRef<Range | null>(null);
  /** 掴んで動かしたあとの click（指を離した点で起きる）を、選択の切り替えに使わない。 */
  const suppressClickRef = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const selectedRef = useRef(selectedImage);
  selectedRef.current = selectedImage;
  const onSelectRef = useRef(onSelectImage);
  onSelectRef.current = onSelectImage;
  const labels = {
    alt: (index: number) => t('attached_alt', { index }),
    unavailable: t('unavailable_short'),
  };
  const labelsRef = useRef(labels);
  labelsRef.current = labels;

  /** 見た目の印（空・選択・読み上げ名）を DOM に合わせる。中身は変えない。 */
  const syncMarks = useCallback((editor: HTMLElement, body: string, photos: HTMLImageElement[]) => {
    editor.dataset.empty = String(photos.length === 0 && body.replace(/\n/g, '') === '');
    photos.forEach((photo, index) => {
      const src = photo.getAttribute('src') ?? '';
      const alt = src ? labelsRef.current.alt(index + 1) : labelsRef.current.unavailable;
      if (photo.alt !== alt) photo.alt = alt;
      const selected = selectedRef.current === index;
      if (selected !== photo.hasAttribute('data-selected')) {
        photo.toggleAttribute('data-selected', selected);
      }
    });
  }, []);

  /** 中身を読み、印を合わせて知らせる。 */
  const emit = useCallback((): SpBodySnapshot => {
    const editor = editorRef.current;
    if (!editor) return { body: '', images: [] };
    const photos = photosIn(editor);
    const snapshot = { body: serializeEditorText(editor), images: photos.map(toPhoto) };
    syncMarks(editor, snapshot.body, photos);
    onChangeRef.current(snapshot);
    return snapshot;
  }, [syncMarks]);

  /** 最後のカーソル（本文の中にあれば）。無ければ末尾。 */
  const caretRange = useCallback((editor: HTMLElement): Range => {
    const saved = savedRangeRef.current;
    if (saved && editor.contains(saved.startContainer)) return saved.cloneRange();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    return range;
  }, []);

  const placeCaret = useCallback((range: Range) => {
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    savedRangeRef.current = range.cloneRange();
  }, []);

  /**
   * 文字をカーソルの位置に入れる。execCommand は編集の履歴（取り消し）とカーソルを保ち、input も
   * 起こす。使えない環境（jsdom 等）では Range で入れる。
   */
  const insertPlain = useCallback(
    (editor: HTMLElement, text: string) => {
      const done =
        typeof document.execCommand === 'function' &&
        document.execCommand('insertText', false, text);
      if (done) return;
      const range = caretRange(editor);
      range.deleteContents();
      const node = document.createTextNode(text);
      range.insertNode(node);
      const after = document.createRange();
      after.setStartAfter(node);
      after.collapse(true);
      placeCaret(after);
    },
    [caretRange, placeCaret],
  );

  /** カーソルの行を見せる（キーボードやシートの下に隠さない）。 */
  const revealCaret = useCallback(() => {
    const editor = editorRef.current;
    const selection = window.getSelection();
    if (!editor || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (!editor.contains(range.startContainer)) return;
    const rect = caretRect(range);
    if (rect) revealRect(editor, rect);
  }, []);

  // 開いたときの中身。以後は DOM が正。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 開いた時点の中身で一度だけ作る
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.contentEditable = editableMode();
    renderInto(editor, initialBody, initialImages);
    syncMarks(editor, initialBody, photosIn(editor));
    if (autoFocus && initialBody === '') editor.focus({ preventScroll: true });
  }, []);

  // 選んだ写真の縁取り。
  // biome-ignore lint/correctness/useExhaustiveDependencies: 選択が変わったことが契機（値は ref から読む）
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    syncMarks(editor, serializeEditorText(editor), photosIn(editor));
  }, [selectedImage, syncMarks]);

  // 本文の中のカーソルを覚える。
  useEffect(() => {
    const remember = () => {
      const editor = editorRef.current;
      const selection = window.getSelection();
      if (!editor || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (editor.contains(range.startContainer)) savedRangeRef.current = range.cloneRange();
    };
    document.addEventListener('selectionchange', remember);
    return () => document.removeEventListener('selectionchange', remember);
  }, []);

  /**
   * キーボードが出て殻の本文の箱が縮んだら、カーソルの行を見えている範囲の真ん中まで送る。
   *
   * きっかけは**箱の大きさ**（`ResizeObserver`）。ビジュアルビューポートの resize の時点では殻の高さが
   * まだ変わっておらず、見せ直しても縮んだあとの箱では隠れた（押した行にキーボードが覆いかぶさり、
   * 1 文字打つまで見えなかった。実機レビュー）。広がったとき（キーボードが閉じた）は動かさない。
   */
  useEffect(() => {
    const editor = editorRef.current;
    const container = editor ? scrollContainerOf(editor) : null;
    if (!editor || !container || typeof ResizeObserver === 'undefined') return;
    let lastHeight = container.clientHeight;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      const height = container.clientHeight;
      const shrank = height < lastHeight;
      lastHeight = height;
      if (!shrank || document.activeElement !== editor) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        if (!editor.contains(range.startContainer)) return;
        const rect = caretRect(range);
        if (rect) liftToMiddle(editor, rect);
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      insertPhoto: (photo) => {
        const editor = editorRef.current;
        if (!editor) return { body: '', images: [] };
        const range = caretRange(editor);
        const node = createInlineImageElement(
          {
            offset: 0,
            storagePath: photo.storagePath,
            widthRatio: photo.widthRatio,
            layout: photo.layout,
            align: photo.align,
            ...(photo.aspect ? { aspect: photo.aspect } : {}),
          },
          photo.signedUrl,
        );
        range.insertNode(node);
        const after = document.createRange();
        after.setStartAfter(node);
        after.collapse(true);
        placeCaret(after);
        const snapshot = emit();
        requestAnimationFrame(() => revealRect(editor, node.getBoundingClientRect()));
        return snapshot;
      },
      insertText: (text) => {
        const editor = editorRef.current;
        if (!editor) return { body: '', images: [] };
        editor.focus({ preventScroll: true });
        const range = caretRange(editor);
        placeCaret(range);
        // カーソルより前の本文（写真・改行の数え方は保存形式と同じ）。
        const head = document.createRange();
        head.setStart(editor, 0);
        head.setEnd(range.startContainer, range.startOffset);
        const holder = document.createElement('div');
        holder.appendChild(head.cloneContents());
        const before = serializeEditorText(holder);
        insertPlain(editor, `${before && !before.endsWith('\n') ? '\n' : ''}${text}`);
        const snapshot = emit();
        requestAnimationFrame(revealCaret);
        return snapshot;
      },
      updateImage: (index, patch) => {
        const editor = editorRef.current;
        const photo = editor ? photosIn(editor)[index] : undefined;
        if (!photo) return emit();
        applyInlineImageStyle(photo, { ...readInlineImageFromElement(photo), ...patch });
        return emit();
      },
      removeImage: (index) => {
        const editor = editorRef.current;
        const photo = editor ? photosIn(editor)[index] : undefined;
        photo?.remove();
        editor?.normalize();
        return emit();
      },
      setContent: (body, images) => {
        const editor = editorRef.current;
        if (!editor) return { body: '', images: [] };
        savedRangeRef.current = null;
        renderInto(editor, body, images);
        return emit();
      },
      focus: () => {
        const editor = editorRef.current;
        if (!editor) return;
        editor.focus({ preventScroll: true });
        placeCaret(caretRange(editor));
        requestAnimationFrame(revealCaret);
      },
    }),
    [caretRange, placeCaret, emit, revealCaret, insertPlain],
  );

  /**
   * 選んでいる写真を指で掴んで動かす。
   *
   * - **写真そのものを、動かしている間ずっと落とす先へ入れ直す**（半透明の置き場所）。文字はその場で
   *   回り込み直すので、離したらどうなるかが見える。以前は指の下に細い線を出すだけで、置いたあとに文字が
   *   どうずれるか分からなかった（実機レビュー）
   * - 指に付いてくるのは小さな写し。**掴んだ点が写しの同じ点に来る**（iOS のドラッグと同じ）。指の上に浮かせて
   *   いた頃は、動かすほど指から離れて見えた（実機レビュー）
   * - 入れ直しは、指が置き場所の箱から出たとき、かつ前に入れ直した点から半行ぶん以上動いたときだけ。
   *   入れ直しで文字がずれ、指の下の文字の位置が行き来して写真が震えるのを防ぐ（半行は本文の行の高さから）
   * - 本文の見えている範囲の端（1 行ぶん）に寄せると、寄せた深さに比例して本文を送る。速さは**時間あたり**
   *   （深さいっぱいで、見えている高さの半分を 1 秒）。フレームあたりで送っていた頃は速すぎて合わせにくかった
   */
  function startDrag(event: React.PointerEvent<HTMLDivElement>, photo: HTMLImageElement) {
    const editor = editorRef.current;
    const ghost = ghostRef.current;
    const host = editor?.parentElement;
    if (!editor || !ghost || !host) return;
    event.preventDefault();
    const scroller = scrollParent(editor);
    const pointerId = event.pointerId;
    const lineHeight =
      Number.parseFloat(getComputedStyle(editor).lineHeight) ||
      photo.getBoundingClientRect().height;
    let point = { x: event.clientX, y: event.clientY };
    let lastPlaced = { ...point };
    let moved = false;
    let frame = 0;
    let scrolledAt: number | null = null;

    // 掴んだ点（写真の中の割合）。写しの同じ点を指の下に置く。
    const grabbed = photo.getBoundingClientRect();
    const ratio = (offset: number, size: number) =>
      size > 0 ? Math.min(100, Math.max(0, (offset / size) * 100)) : 50;
    ghost.style.setProperty('--grab-x', `${ratio(point.x - grabbed.left, grabbed.width)}%`);
    ghost.style.setProperty('--grab-y', `${ratio(point.y - grabbed.top, grabbed.height)}%`);
    ghost.src = photo.currentSrc || photo.src;
    ghost.hidden = false;
    photo.setAttribute('data-dragging', '');

    /** 指の点へ写真を入れ直す（置き場所の箱の外で、前の点から半行以上動いていれば）。 */
    const place = (force: boolean) => {
      const box = photo.getBoundingClientRect();
      const inside =
        point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom;
      if (inside) return;
      if (!force && Math.hypot(point.x - lastPlaced.x, point.y - lastPlaced.y) < lineHeight / 2)
        return;
      const range = dropRangeAt(editor, point.x, point.y);
      if (range && movePhotoTo(photo, range)) {
        moved = true;
        lastPlaced = { ...point };
      }
    };

    const paint = (now: number) => {
      frame = 0;
      // 先に写真を入れ直し、そのあとで写しを置く（入れ直しで本文がずれても、写しは指の下に居る）。
      place(false);
      const origin = host.getBoundingClientRect();
      ghost.style.insetInlineStart = `${point.x - origin.left}px`;
      ghost.style.insetBlockStart = `${point.y - origin.top}px`;
      if (!scroller) return;
      const band = scroller.getBoundingClientRect();
      const depth =
        point.y < band.top + lineHeight
          ? (point.y - (band.top + lineHeight)) / lineHeight
          : point.y > band.bottom - lineHeight
            ? (point.y - (band.bottom - lineHeight)) / lineHeight
            : 0;
      if (depth === 0) {
        scrolledAt = null;
        return;
      }
      const elapsed = scrolledAt === null ? 0 : now - scrolledAt;
      scrolledAt = now;
      const ratio = Math.max(-1, Math.min(1, depth));
      scroller.scrollBy({ top: (ratio * scroller.clientHeight * elapsed) / 2000 });
      frame = requestAnimationFrame(paint);
    };

    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      point = { x: e.clientX, y: e.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const finish = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      if (frame) cancelAnimationFrame(frame);
      point = { x: e.clientX, y: e.clientY };
      place(true);
      ghost.hidden = true;
      ghost.removeAttribute('src');
      photo.removeAttribute('data-dragging');
      if (!moved) return;
      // 動かしたあとの click（指を離した点で起きる）を、選択の切り替えに使わない。
      suppressClickRef.current = true;
      emit();
      const index = photosIn(editor).indexOf(photo);
      onSelectRef.current(index >= 0 ? index : null);
      requestAnimationFrame(() => revealRect(editor, photo.getBoundingClientRect()));
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  }

  return (
    <div className="relative">
      {/* biome-ignore lint/a11y/useSemanticElements lint/a11y/useKeyWithClickEvents: textarea は本文の中に写真を描けないので contentEditable に役割を名乗らせる。click は本文の中の写真を押したときだけ使い、写真の操作はパレットのボタンにある */}
      <div
        ref={editorRef}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        tabIndex={0}
        data-placeholder={placeholder}
        data-sp-body
        {...verifyAttrs({
          unit: 'SpBodyEditor',
          selectedImage: selectedImage ?? 'none',
        })}
        className="oz-sp-body min-h-[40vh] px-6 pb-4"
        style={style}
        onInput={() => {
          emit();
        }}
        onPaste={(e) => {
          // 書式は持ち込まない（本文は文字と写真だけ）。
          const text = e.clipboardData.getData('text/plain');
          e.preventDefault();
          const editor = editorRef.current;
          if (!text || !editor) return;
          insertPlain(editor, text);
          emit();
        }}
        onFocus={() => {
          if (selectedRef.current !== null) onSelectRef.current(null);
        }}
        onPointerDown={(e) => {
          suppressClickRef.current = false;
          const target = e.target;
          if (!(target instanceof Node) || !isInlineImage(target)) return;
          // 写真を押してもカーソルを置かない（キーボードを出さない）。選んでいる写真なら掴む。
          if (target.hasAttribute('data-selected') && e.isPrimary) {
            startDrag(e, target);
            return;
          }
          if (e.pointerType === 'mouse') e.preventDefault();
        }}
        onClick={(e) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          const editor = editorRef.current;
          const target = e.target;
          if (!editor || !(target instanceof Node) || !isInlineImage(target)) return;
          const index = photosIn(editor).indexOf(target);
          if (document.activeElement === editor) editor.blur();
          onSelectRef.current(selectedRef.current === index ? null : index);
        }}
      />
      {/* 掴んだ写真の小さな写し（掴んだ点が指の下に付いてくる）。 */}
      {/* biome-ignore lint/performance/noImgElement: 本文の中の写真（署名付き URL）をそのまま写す。next/image の loader を通さない */}
      <img
        ref={ghostRef}
        hidden
        alt=""
        aria-hidden="true"
        data-photo-ghost
        className="oz-photo-ghost"
      />
    </div>
  );
});
