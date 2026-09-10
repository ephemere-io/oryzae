import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudyHome } from '@/features/shared/study/hooks/use-study-home-flag';

// PostHog の返事は差し替えられるようにしておく（既定は「まだ分からない」の undefined）。
const posthog = vi.hoisted(() => {
  const holder: { value: boolean | undefined } = { value: undefined };
  return holder;
});
vi.mock('posthog-js/react', () => ({ useFeatureFlagEnabled: () => posthog.value }));

const ENV_KEY = 'NEXT_PUBLIC_STUDY_HOME';
let savedEnv: string | undefined;

beforeEach(() => {
  savedEnv = process.env[ENV_KEY];
  delete process.env[ENV_KEY];
  localStorage.clear();
  window.history.replaceState({}, '', '/study');
  posthog.value = undefined;
});

afterEach(() => {
  cleanup();
  if (savedEnv === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = savedEnv;
});

describe('useStudyHome', () => {
  it('env を置かなくても出る（既定で全員に書斎ホーム）', () => {
    const { result } = renderHook(() => useStudyHome());
    expect(result.current.enabled).toBe(true);
  });

  it('PostHog が false を返しても落とさない（フラグが無い・対象外でも false になるため）', () => {
    posthog.value = false;
    const { result } = renderHook(() => useStudyHome());
    expect(result.current.enabled).toBe(true);
  });

  it('NEXT_PUBLIC_STUDY_HOME=off で止まる（撤退口）', () => {
    process.env[ENV_KEY] = 'off';
    const { result } = renderHook(() => useStudyHome());
    expect(result.current.enabled).toBe(false);
  });

  it('端末ごとの ?study=off は env より優先する', async () => {
    window.history.replaceState({}, '', '/study?study=off');
    const { result } = renderHook(() => useStudyHome());
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.enabled).toBe(false);
  });
});
