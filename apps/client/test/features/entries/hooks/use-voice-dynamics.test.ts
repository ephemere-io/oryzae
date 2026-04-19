import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceDynamics } from '@/features/entries/hooks/use-voice-dynamics';

type RecognitionLike = {
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: Record<string, unknown>) => void) | null;
};

let currentRecognition: RecognitionLike | null = null;

class FakeSpeechRecognition implements RecognitionLike {
  start = vi.fn(() => {
    this.onstart?.();
  });
  stop = vi.fn();
  continuous = false;
  interimResults = false;
  lang = '';
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onresult: ((e: Record<string, unknown>) => void) | null = null;
  constructor() {
    currentRecognition = this;
  }
}

describe('useVoiceDynamics', () => {
  let editorEl: HTMLDivElement;
  let editorRef: { current: HTMLDivElement | null };
  let getUserMedia: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    currentRecognition = null;

    editorEl = document.createElement('div');
    editorEl.contentEditable = 'true';
    document.body.appendChild(editorEl);
    editorRef = { current: editorEl };

    const fakeTrack = { stop: vi.fn() };
    const fakeStream = { getTracks: () => [fakeTrack] };
    getUserMedia = vi.fn().mockResolvedValue(fakeStream);

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });

    const fakeAnalyser = {
      fftSize: 0,
      frequencyBinCount: 256,
      getFloatTimeDomainData: vi.fn(),
    };
    const fakeSource = { connect: vi.fn() };
    class FakeAudioContext {
      state = 'running';
      resume = vi.fn();
      close = vi.fn();
      createAnalyser = vi.fn(() => fakeAnalyser);
      createMediaStreamSource = vi.fn(() => fakeSource);
    }
    Object.defineProperty(window, 'AudioContext', {
      configurable: true,
      value: FakeAudioContext,
    });
  });

  afterEach(() => {
    editorEl.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
    // biome-ignore lint/suspicious/noExplicitAny: test teardown of global
    (window as any).SpeechRecognition = undefined;
    // biome-ignore lint/suspicious/noExplicitAny: test teardown of global
    (window as any).webkitSpeechRecognition = undefined;
  });

  it('requests OS default microphone explicitly so getUserMedia follows OS changes', async () => {
    renderHook(() => useVoiceDynamics(editorRef, true));

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledWith({ audio: { deviceId: 'default' } });
    });
  });

  it('does not request microphone when disabled', () => {
    renderHook(() => useVoiceDynamics(editorRef, false));
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('reports unsupported when SpeechRecognition is missing', async () => {
    const { result } = renderHook(() => useVoiceDynamics(editorRef, true));
    await waitFor(() => {
      expect(result.current.unavailable).toBe(true);
    });
    expect(result.current.reason).toBe('unsupported');
  });

  it('stops the restart loop and surfaces reason=network on network error (Brave)', async () => {
    vi.useFakeTimers();
    // biome-ignore lint/suspicious/noExplicitAny: injecting fake into window for the hook under test
    (window as any).SpeechRecognition = FakeSpeechRecognition;

    const { result } = renderHook(() => useVoiceDynamics(editorRef, true));

    await vi.waitFor(() => expect(currentRecognition).not.toBeNull());
    const rec = currentRecognition;
    if (!rec) throw new Error('recognition not created');
    expect(rec.start).toHaveBeenCalledTimes(1);

    act(() => {
      rec.onerror?.({ error: 'network' });
      rec.onend?.();
      // Restart would happen ~50ms later if not blocked
      vi.advanceTimersByTime(200);
    });

    await vi.waitFor(() => expect(result.current.unavailable).toBe(true));
    expect(result.current.reason).toBe('network');
    // restart must not happen after fatal error
    expect(rec.start).toHaveBeenCalledTimes(1);
  });
});
