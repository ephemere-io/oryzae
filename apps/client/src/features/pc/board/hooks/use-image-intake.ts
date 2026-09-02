'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * 盤面に画像が「入ってくる」経路をまとめて受ける。
 *
 * 道具の名前が「画像を貼り付け」なのに、実際に貼り付ける操作——コピーして Cmd+V、
 * ファイルを盤面へドラッグ——が何も起きなかった。押せるのはツールバーのボタンだけで、
 * 名前と操作が一致していない。ここで両方を拾い、どの経路でも同じ写真ダイアログに
 * 画像を渡す。
 *
 * paste は capture で拾う。React 側の stopPropagation に潰されないようにするため
 * （use-escape-key と同じ理由）。入力中（INPUT/TEXTAREA/contenteditable）は横取り
 * しない——文字を貼りたいだけの操作を奪わない。
 */
export function useImageIntake(enabled: boolean, onImage: (file: File) => void) {
  /** ドラッグ中に盤面へ目印を出すためのフラグ。 */
  const [dragActive, setDragActive] = useState(false);

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (!enabled) return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return;
      }
      // 貼り付けは files だけを見ていると取りこぼす。スクリーンショットや Web ページから
      // コピーした画像は files が空で items 側にしか入らないことがある（Safari と、
      // コピー元によっては Chrome も）。両方見る。
      const file = imageFromClipboard(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      onImage(file);
    },
    [enabled, onImage],
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('paste', handlePaste, true);
    return () => window.removeEventListener('paste', handlePaste, true);
  }, [enabled, handlePaste]);

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return;
      // 画像を持っているドラッグだけ受ける。カードの移動は盤面側の pointer 操作なので
      // ここには来ない。
      if (!Array.from(e.dataTransfer.types).includes('Files')) return;
      e.preventDefault();
      setDragActive(true);
    },
    [enabled],
  );

  const onDragLeave = useCallback((e: React.DragEvent) => {
    // 子要素をまたぐたびに leave が飛ぶので、盤面の外へ出たときだけ消す。
    if (e.currentTarget.contains(e.relatedTarget instanceof Node ? e.relatedTarget : null)) return;
    setDragActive(false);
  }, []);

  // ドラッグ中に受け付けをやめたら目印を畳む。enabled は動的な値（スニペット編集や
  // ライトボックスを開くと false になる）なので、途中で切り替わると onDragOver は
  // 止まるのに目印だけ残る。この後もう dragover は来ないので、ここで消すしかない。
  useEffect(() => {
    if (!enabled) setDragActive(false);
  }, [enabled]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!enabled) return;
      const file = firstImage(e.dataTransfer.files);
      setDragActive(false);
      if (!file) return;
      e.preventDefault();
      onImage(file);
    },
    [enabled, onImage],
  );

  return { dragActive, onDragOver, onDragLeave, onDrop };
}

function firstImage(files: FileList | null | undefined): File | null {
  if (!files) return null;
  for (const file of Array.from(files)) {
    if (file.type.startsWith('image/')) return file;
  }
  return null;
}

function imageFromClipboard(data: DataTransfer | null | undefined): File | null {
  if (!data) return null;
  const fromFiles = firstImage(data.files);
  if (fromFiles) return fromFiles;
  for (const item of Array.from(data.items ?? [])) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) return file;
  }
  return null;
}
