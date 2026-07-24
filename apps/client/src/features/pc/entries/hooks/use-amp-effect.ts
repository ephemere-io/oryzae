'use client';

import { useEffect, useRef } from 'react';

/**
 * 打鍵音増幅 (Typing Amplifier / ASMR) エフェクト
 *
 * マイクから音声を取得し、オーディオフィルタチェーンを通す。
 * キーを押すたびに gain を瞬間的に上げ、タイピングのクリック音だけが
 * 強調されて聞こえるASMR的な体験を生み出す。
 *
 * Audio chain: mic → highpass(350Hz) → highshelf(+8dB@3500Hz) → gain → compressor → speakers
 */
export function useAmpEffect(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const envelopeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    function triggerHit() {
      const ctx = ctxRef.current;
      const gain = gainRef.current;
      if (!ctx || !gain) return;

      const now = ctx.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.001), now);
      gain.gain.exponentialRampToValueAtTime(4.0, now + 0.01);

      if (envelopeTimerRef.current) clearTimeout(envelopeTimerRef.current);
      envelopeTimerRef.current = setTimeout(() => {
        const ctx2 = ctxRef.current;
        const gain2 = gainRef.current;
        if (!ctx2 || !gain2) return;
        const t = ctx2.currentTime;
        gain2.gain.cancelScheduledValues(t);
        gain2.gain.setValueAtTime(Math.max(gain2.gain.value, 0.001), t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      }, 60);
    }

    function handleKey(e: KeyboardEvent) {
      if (e.repeat) return;
      triggerHit();
    }

    async function start() {
      if (cancelled) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => {
            t.stop();
          });
          return;
        }
        streamRef.current = stream;

        const ctx = new AudioContext();
        if (ctx.state === 'suspended') await ctx.resume();
        ctxRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);

        const lowCut = ctx.createBiquadFilter();
        lowCut.type = 'highpass';
        lowCut.frequency.value = 350;

        const highBoost = ctx.createBiquadFilter();
        highBoost.type = 'highshelf';
        highBoost.frequency.value = 3500;
        highBoost.gain.value = 8;

        const gain = ctx.createGain();
        gain.gain.value = 0.001;
        gainRef.current = gain;

        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 5;
        compressor.ratio.value = 8;
        compressor.attack.value = 0.002;
        compressor.release.value = 0.1;

        source.connect(lowCut);
        lowCut.connect(highBoost);
        highBoost.connect(gain);
        gain.connect(compressor);
        compressor.connect(ctx.destination);

        // Safari: play silent buffer to unlock audio output
        try {
          const silentBuf = ctx.createBuffer(1, 1, ctx.sampleRate);
          const silentSrc = ctx.createBufferSource();
          silentSrc.buffer = silentBuf;
          silentSrc.connect(ctx.destination);
          silentSrc.start(0);
        } catch {
          // ignore
        }

        window.addEventListener('keydown', handleKey);
        window.addEventListener('keyup', handleKey);
      } catch {
        // Microphone access denied — silently disable
      }
    }

    start();

    return () => {
      cancelled = true;
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
      if (envelopeTimerRef.current) clearTimeout(envelopeTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => {
          t.stop();
        });
        streamRef.current = null;
      }
      if (ctxRef.current) {
        ctxRef.current.close();
        ctxRef.current = null;
      }
      gainRef.current = null;
    };
  }, [enabled]);
}
