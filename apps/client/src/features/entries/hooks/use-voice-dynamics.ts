'use client';

import { useEffect, useRef } from 'react';

/**
 * 音量内包エフェクト
 *
 * Web Speech API で音声認識し、Web Audio API でリアルタイム音量(RMS)を取得。
 * 声の大きさに応じてテキストのフォントサイズが変化する (1.0em〜4.5em)。
 * 認識中のテキストはリアルタイムで音量に追従し、確定時にピーク音量でロック。
 */

function mapVolumeToSize(rms: number): number {
  const effective = Math.max(0, rms - 0.01);
  return Math.max(1.0, Math.min(1.0 + effective * 2.0, 4.5));
}

function insertNodeAtCursor(editor: HTMLElement, node: Node) {
  const sel = window.getSelection();
  editor.focus();
  if (!sel?.rangeCount) {
    editor.appendChild(node);
    return;
  }
  const range = sel.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) {
    editor.appendChild(node);
    const r = document.createRange();
    r.selectNodeContents(editor);
    r.collapse(false);
    sel.removeAllRanges();
    sel.addRange(r);
  }
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
}

// biome-ignore lint/suspicious/noExplicitAny: Web Speech API types are not in standard TS lib
type SpeechRecognitionLike = {
  start(): void;
  stop(): void;
  onend: unknown;
  onstart: unknown;
  onresult: unknown;
  onerror: unknown;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
};

function getSpeechRecognitionConstructor(): (new () => SpeechRecognitionLike) | null {
  // @type-assertion-allowed: Web Speech API (SpeechRecognition) is not in standard TS DOM types
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

export function useVoiceDynamics(
  editorRef: React.RefObject<HTMLDivElement | null>,
  enabled: boolean,
) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const interimRef = useRef<HTMLSpanElement | null>(null);
  const peakRmsRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !enabled) return;

    let dataArray: Float32Array<ArrayBuffer> | null = null;

    function ensureInterim() {
      if (!interimRef.current?.parentNode) {
        const span = document.createElement('span');
        span.className = 'v-interim';
        span.style.cssText = 'color:rgba(0,0,0,0.35);font-size:1em;';
        interimRef.current = span;
        if (editor) insertNodeAtCursor(editor, span);
      }
    }

    function commitText(text: string, peakRms: number) {
      const size = mapVolumeToSize(peakRms);
      const span = document.createElement('span');
      span.className = 'v-block';
      span.style.fontSize = `${size.toFixed(2)}em`;
      span.textContent = text;

      if (interimRef.current?.parentNode) {
        interimRef.current.parentNode.insertBefore(span, interimRef.current);
      } else if (editor) {
        insertNodeAtCursor(editor, span);
      }

      const sel = window.getSelection();
      if (sel) {
        const range = document.createRange();
        range.setStartAfter(span);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    function audioLoop() {
      if (!enabledRef.current || !analyserRef.current || !dataArray) return;
      rafRef.current = requestAnimationFrame(audioLoop);
      analyserRef.current.getFloatTimeDomainData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i] * dataArray[i];
      const rms = Math.sqrt(sum / dataArray.length);
      peakRmsRef.current = Math.max(peakRmsRef.current, rms);

      if (interimRef.current?.textContent && interimRef.current.textContent.length > 0) {
        const targetSize = mapVolumeToSize(rms);
        const currentSize = Number.parseFloat(interimRef.current.style.fontSize) || 1.0;
        const newSize =
          targetSize > currentSize
            ? currentSize * 0.2 + targetSize * 0.8
            : currentSize * 0.8 + targetSize * 0.2;
        interimRef.current.style.fontSize = `${newSize.toFixed(2)}em`;
      }
    }

    async function startAudio() {
      try {
        const ctx = new AudioContext();
        if (ctx.state === 'suspended') await ctx.resume();
        audioCtxRef.current = ctx;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyserRef.current = analyser;
        const source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
        dataArray = new Float32Array(analyser.frequencyBinCount);
        audioLoop();
      } catch {
        // Microphone access denied
      }
    }

    function startSpeech() {
      const SR = getSpeechRecognitionConstructor();
      if (!SR) return;

      const recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'ja-JP';
      recognitionRef.current = recognition;

      recognition.onstart = () => {
        ensureInterim();
      };

      // biome-ignore lint/suspicious/noExplicitAny: Web Speech API event types
      recognition.onresult = (e: Record<string, unknown>) => {
        const results = e.results as { isFinal: boolean; 0: { transcript: string } }[];
        const resultIndex = (e.resultIndex as number) ?? 0;
        let finalStr = '';
        let interimStr = '';
        for (let i = resultIndex; i < results.length; i++) {
          if (results[i].isFinal) {
            finalStr += results[i][0].transcript;
          } else {
            interimStr += results[i][0].transcript;
          }
        }
        if (finalStr) {
          commitText(finalStr, peakRmsRef.current);
          peakRmsRef.current = 0;
        }
        if (interimRef.current) {
          interimRef.current.textContent = interimStr;
        }
      };

      recognition.onerror = () => {
        // Ignore no-speech / aborted errors
      };

      recognition.onend = () => {
        if (enabledRef.current && recognitionRef.current) {
          setTimeout(() => {
            if (enabledRef.current && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch {
                // ignore
              }
            }
          }, 50);
        }
      };

      try {
        recognition.start();
      } catch {
        // ignore
      }
    }

    startAudio();
    startSpeech();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
        audioCtxRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          t.stop();
        });
        streamRef.current = null;
      }
      analyserRef.current = null;
      if (interimRef.current?.parentNode) {
        interimRef.current.remove();
        interimRef.current = null;
      }
    };
  }, [editorRef, enabled]);
}
