'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import {
  type CSSProperties,
  Fragment,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type { AttachedPhoto } from '@/features/shared/entries/types';
import { joinBodySegments, splitBodyAtPhotos } from '@/features/shared/entries/utils/inline-photos';

export interface SpBodyEditorHandle {
  /** いまのカーソル（文の添字と、その文の中の位置）。フォーカスが無ければ最後に触った場所。 */
  caret(): { segment: number; offset: number };
  /** 文 `segment` の `offset` にカーソルを置く（描画が追いついてから）。 */
  focusSegment(segment: number, offset: number): void;
}

interface SpBodyEditorProps {
  /** 本文。写真の位置は U+FFFC（`inline-photos.ts`）。 */
  value: string;
  /** 本文の中の写真（置き順）。数はプレースホルダの数と同じ。 */
  images: readonly AttachedPhoto[];
  onChange: (value: string) => void;
  /**
   * 写真を抜く（置き順の添字）。本文の繋ぎ直し（`removePhotoAt`）と写真の一覧の更新は呼び出し側が
   * 一度に行う（別々に更新すると、途中の描画で数が食い違う）。ここはカーソルの置き場を手配するだけ。
   */
  onRemoveImage: (index: number) => void;
  placeholder: string;
  ariaLabel: string;
  /** 本文の見た目（書体・大きさ・行間・字間）。 */
  style: CSSProperties;
  autoFocus?: boolean;
}

/**
 * SP の本文。**文のブロックと写真のブロックの列**（Notion のモバイルと同じ）。
 *
 * textarea は画像を描けない。本文をプレースホルダで切り、文ごとに伸びる textarea、間に全幅の写真を
 * 置く。書き手には 1 枚の紙に見える（枠も余白も持たない）。写真は右上の × か、直後の文の先頭で
 * BackSpace で抜ける（Notion と同じ）。
 *
 * 保存形式は PC と同じ（本文の U+FFFC + `effects.inlineImages`）。ここは描くだけで、形式の往復は
 * `features/shared/entries/utils/inline-photos.ts`。
 */
export const SpBodyEditor = forwardRef<SpBodyEditorHandle, SpBodyEditorProps>(function SpBodyEditor(
  { value, images, onChange, onRemoveImage, placeholder, ariaLabel, style, autoFocus },
  ref,
) {
  const t = useTranslations('photo');
  const segments = useMemo(() => splitBodyAtPhotos(value), [value]);
  const areaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
  const activeRef = useRef<{ segment: number; offset: number } | null>(null);
  const pendingFocusRef = useRef<{ segment: number; offset: number } | null>(null);

  /** 頼まれていたカーソルを、その文の textarea が居れば置く。 */
  const applyPendingFocus = useCallback(() => {
    const pending = pendingFocusRef.current;
    if (!pending) return;
    const el = areaRefs.current[pending.segment];
    if (!el) return;
    pendingFocusRef.current = null;
    const at = Math.min(pending.offset, el.value.length);
    el.focus();
    el.setSelectionRange(at, at);
    activeRef.current = { segment: pending.segment, offset: at };
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      caret: () =>
        activeRef.current ?? {
          segment: segments.length - 1,
          offset: (segments[segments.length - 1] ?? '').length,
        },
      focusSegment: (segment, offset) => {
        pendingFocusRef.current = { segment, offset };
        applyPendingFocus();
      },
    }),
    [segments, applyPendingFocus],
  );

  // 文の列が変わった（写真を差した／抜いた）あとに、頼まれていたカーソルを置く。
  // biome-ignore lint/correctness/useExhaustiveDependencies: segments が変わるたびに走らせるのが目的
  useEffect(() => {
    applyPendingFocus();
  }, [segments]);

  function updateSegment(index: number, text: string) {
    const next = [...segments];
    next[index] = text;
    onChange(joinBodySegments(next));
  }

  function track(index: number, el: HTMLTextAreaElement) {
    activeRef.current = { segment: index, offset: el.selectionStart ?? el.value.length };
  }

  function removeImage(index: number) {
    const before = segments[index] ?? '';
    pendingFocusRef.current = { segment: index, offset: before.length };
    onRemoveImage(index);
  }

  return (
    <div
      {...verifyAttrs({
        unit: 'SpBodyEditor',
        segmentCount: segments.length,
        imageCount: images.length,
      })}
      className="flex flex-col"
    >
      {segments.map((text, index) => {
        const image = index > 0 ? images[index - 1] : undefined;
        const last = index === segments.length - 1;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: 文の列は添字が意味（置き順）。差し替えは値で追う
          <Fragment key={index}>
            {index > 0 ? (
              <PhotoBlock
                image={image}
                index={index - 1}
                onRemove={() => removeImage(index - 1)}
                removeLabel={t('remove', { index })}
                alt={t('attached_alt', { index })}
                unavailable={t('unavailable_short')}
              />
            ) : null}
            <GrowingTextarea
              ref={(el) => {
                areaRefs.current[index] = el;
              }}
              value={text}
              onChange={(next) => updateSegment(index, next)}
              onCaret={(el) => track(index, el)}
              onBackspaceAtStart={index > 0 ? () => removeImage(index - 1) : undefined}
              placeholder={segments.length === 1 ? placeholder : ''}
              ariaLabel={segments.length === 1 ? ariaLabel : `${ariaLabel} ${index + 1}`}
              style={style}
              autoFocus={Boolean(autoFocus) && index === 0 && segments.length === 1}
              // 最後の文は指で押せる余白を持つ。途中の文は書いた分だけ。
              className={last ? 'min-h-[40vh] pb-4' : 'min-h-[2.4em]'}
            />
          </Fragment>
        );
      })}
    </div>
  );
});

interface GrowingTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onCaret: (el: HTMLTextAreaElement) => void;
  onBackspaceAtStart?: () => void;
  placeholder: string;
  ariaLabel: string;
  style: CSSProperties;
  autoFocus: boolean;
  className: string;
}

/** 書いた分だけ伸びる textarea。中でスクロールさせない（殻の本文が動き、題が上段に上がる）。 */
const GrowingTextarea = forwardRef<HTMLTextAreaElement, GrowingTextareaProps>(
  function GrowingTextarea(
    {
      value,
      onChange,
      onCaret,
      onBackspaceAtStart,
      placeholder,
      ariaLabel,
      style,
      autoFocus,
      className,
    },
    ref,
  ) {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const growKey = `${value.length}:${String(style.fontFamily)}:${String(style.fontSize)}:${String(style.lineHeight)}:${String(style.letterSpacing)}`;
    // biome-ignore lint/correctness/useExhaustiveDependencies: growKey が測り直す契機（本文と見た目）をまとめる
    useEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      const grow = () => {
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      };
      grow();
      let cancelled = false;
      document.fonts?.ready.then(() => {
        if (!cancelled) grow();
      });
      window.addEventListener('resize', grow);
      return () => {
        cancelled = true;
        window.removeEventListener('resize', grow);
      };
    }, [growKey]);

    return (
      <textarea
        ref={(el) => {
          innerRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        // biome-ignore lint/a11y/noAutofocus: 開いた瞬間に書き始められることが要件（親が 1 つ目にだけ渡す）
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onCaret(e.target);
        }}
        onSelect={(e) => onCaret(e.currentTarget)}
        onFocus={(e) => onCaret(e.currentTarget)}
        onClick={(e) => onCaret(e.currentTarget)}
        onKeyUp={(e) => onCaret(e.currentTarget)}
        onKeyDown={(e) => {
          if (
            e.key === 'Backspace' &&
            onBackspaceAtStart &&
            e.currentTarget.selectionStart === 0 &&
            e.currentTarget.selectionEnd === 0
          ) {
            e.preventDefault();
            onBackspaceAtStart();
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`w-full resize-none overflow-hidden bg-transparent px-6 outline-none placeholder:opacity-30 ${className}`}
        style={style}
      />
    );
  },
);

function PhotoBlock({
  image,
  index,
  onRemove,
  removeLabel,
  alt,
  unavailable,
}: {
  image: AttachedPhoto | undefined;
  index: number;
  onRemove: () => void;
  removeLabel: string;
  alt: string;
  unavailable: string;
}) {
  return (
    <figure data-body-photo={index} className="relative my-3 px-6">
      {image?.signedUrl ? (
        // biome-ignore lint/performance/noImgElement: Storage の署名付き URL。next/image の loader 設定なしに扱う
        <img
          src={image.signedUrl}
          alt={alt}
          className="block w-full rounded-2xl object-cover"
          style={{ border: '1px solid var(--border-subtle)', maxHeight: '70vw' }}
        />
      ) : (
        <div
          role="img"
          aria-label={unavailable}
          className="flex h-32 w-full items-center justify-center rounded-2xl text-[11px]"
          style={{
            border: '1px dashed var(--border-subtle)',
            color: 'var(--date-color)',
            background: 'var(--toolbar-hover)',
          }}
        >
          {unavailable}
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="absolute right-8 top-2 flex h-8 w-8 items-center justify-center rounded-full text-[15px] leading-none text-white"
        style={{ background: 'rgba(0,0,0,0.45)' }}
      >
        ×
      </button>
    </figure>
  );
}
