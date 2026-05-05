'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface SnippetToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  api: ApiClient | null;
}

const MAX_SNIPPET_LENGTH = 50;
const SAVED_DISPLAY_MS = 1200;

type Status = 'idle' | 'saving' | 'saved';

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function SnippetToolbar({ editorRef, api }: SnippetToolbarProps) {
  const t = useTranslations('editor.snippet_toolbar');
  const [visible, setVisible] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [status, setStatus] = useState<Status>('idle');
  const toolbarRef = useRef<HTMLDivElement>(null);
  // IME 変換中は selectionchange を無視する（候補テキストが選択範囲扱いになり誤発火するため）
  const composingRef = useRef(false);
  // 「保存しました」表示中は selectionchange 経由の hide を抑制する
  const statusRef = useRef<Status>('idle');
  const savedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const tooLong = selectedText.length > MAX_SNIPPET_LENGTH;
  const isBusy = status !== 'idle';

  const handleSelection = useCallback(() => {
    if (composingRef.current) return;
    if (statusRef.current === 'saved') return;
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !editor.contains(selection.anchorNode)) {
      setVisible(false);
      setSelectedText('');
      return;
    }

    const text = selection.toString().trim();
    if (!text) {
      setVisible(false);
      setSelectedText('');
      return;
    }

    setSelectedText(text);

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // Use viewport coordinates with fixed positioning to escape stacking context
    setPosition({
      top: rect.top - 10,
      left: rect.left + rect.width / 2,
    });
    setVisible(true);
  }, [editorRef]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelection);
    const editor = editorRef.current;
    function handleCompositionStart() {
      composingRef.current = true;
      setVisible(false);
      setSelectedText('');
    }
    function handleCompositionEnd() {
      composingRef.current = false;
    }
    if (editor) {
      editor.addEventListener('mouseup', handleSelection);
      editor.addEventListener('compositionstart', handleCompositionStart);
      editor.addEventListener('compositionend', handleCompositionEnd);
    }
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
      if (editor) {
        editor.removeEventListener('mouseup', handleSelection);
        editor.removeEventListener('compositionstart', handleCompositionStart);
        editor.removeEventListener('compositionend', handleCompositionEnd);
      }
    };
  }, [handleSelection, editorRef]);

  useEffect(() => {
    return () => {
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
    };
  }, []);

  const handleSnippetCreate = useCallback(async () => {
    if (!api || !selectedText || tooLong || isBusy) return;

    setStatus('saving');
    try {
      await api.fetch('/api/v1/board/snippets', {
        method: 'POST',
        body: JSON.stringify({
          text: selectedText,
          dateKey: getTodayKey(),
        }),
      });
      window.getSelection()?.removeAllRanges();
      setStatus('saved');
      if (savedTimeoutRef.current) clearTimeout(savedTimeoutRef.current);
      savedTimeoutRef.current = setTimeout(() => {
        setVisible(false);
        setSelectedText('');
        setStatus('idle');
      }, SAVED_DISPLAY_MS);
    } catch (err) {
      setStatus('idle');
      throw err;
    }
  }, [api, selectedText, tooLong, isBusy]);

  if (!visible) return null;

  const buttonLabel =
    status === 'saving' ? t('saving') : status === 'saved' ? t('saved') : t('create');
  const buttonIcon = status === 'saved' ? '✓' : '✦';

  return (
    <div
      ref={toolbarRef}
      className="pointer-events-auto fixed z-[9999] pb-3"
      style={{
        top: position.top,
        left: position.left,
        transform: 'translate(-50%, -100%)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.2s ease',
      }}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSnippetCreate}
          disabled={tooLong || isBusy}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider shadow-md transition-all disabled:opacity-50"
          style={{
            backgroundColor: 'var(--bg)',
            borderColor: 'var(--accent)',
            color: 'var(--accent)',
            cursor: tooLong ? 'not-allowed' : 'pointer',
            opacity: status === 'saved' ? 1 : undefined,
          }}
          onMouseEnter={(e) => {
            if (!tooLong && !isBusy) {
              e.currentTarget.style.backgroundColor = 'var(--accent)';
              e.currentTarget.style.color = 'white';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg)';
            e.currentTarget.style.color = 'var(--accent)';
          }}
        >
          <span style={{ fontSize: '10px' }}>{buttonIcon}</span>
          {buttonLabel}
        </button>
        {tooLong && (
          <span className="rounded bg-zinc-800 px-2 py-1 text-[10px] text-white shadow">
            {t('too_long')}
          </span>
        )}
      </div>
    </div>
  );
}
