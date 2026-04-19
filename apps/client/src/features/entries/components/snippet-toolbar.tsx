'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiClient } from '@/lib/api';

interface SnippetToolbarProps {
  editorRef: React.RefObject<HTMLDivElement | null>;
  api: ApiClient | null;
}

const MAX_SNIPPET_LENGTH = 50;

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function SnippetToolbar({ editorRef, api }: SnippetToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [saving, setSaving] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  // IME 変換中は selectionchange を無視する（候補テキストが選択範囲扱いになり誤発火するため）
  const composingRef = useRef(false);

  const tooLong = selectedText.length > MAX_SNIPPET_LENGTH;

  const handleSelection = useCallback(() => {
    if (composingRef.current) return;
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

  const handleSnippetCreate = useCallback(async () => {
    if (!api || !selectedText || tooLong || saving) return;

    setSaving(true);
    try {
      await api.fetch('/api/v1/board/snippets', {
        method: 'POST',
        body: JSON.stringify({
          text: selectedText,
          dateKey: getTodayKey(),
        }),
      });
      window.getSelection()?.removeAllRanges();
      setVisible(false);
      setSelectedText('');
    } finally {
      setSaving(false);
    }
  }, [api, selectedText, tooLong, saving]);

  if (!visible) return null;

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
          disabled={tooLong || saving}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider shadow-md transition-all disabled:opacity-50"
          style={{
            backgroundColor: 'var(--bg)',
            borderColor: 'var(--accent)',
            color: 'var(--accent)',
            cursor: tooLong ? 'not-allowed' : 'pointer',
          }}
          onMouseEnter={(e) => {
            if (!tooLong) {
              e.currentTarget.style.backgroundColor = 'var(--accent)';
              e.currentTarget.style.color = 'white';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--bg)';
            e.currentTarget.style.color = 'var(--accent)';
          }}
        >
          <span style={{ fontSize: '10px' }}>✦</span>
          {saving ? '保存中…' : 'スニペット化'}
        </button>
        {tooLong && (
          <span className="rounded bg-zinc-800 px-2 py-1 text-[10px] text-white shadow">
            50文字以内
          </span>
        )}
      </div>
    </div>
  );
}
