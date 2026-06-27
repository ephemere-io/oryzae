import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FermentationDetailHeader } from '@/features/fermentations/components/fermentation-detail-header';
import type { FermentationDetailResponse } from '@/features/fermentations/hooks/use-fermentation-detail';

afterEach(cleanup);

function makeData(overrides: Partial<FermentationDetailResponse> = {}): FermentationDetailResponse {
  return {
    id: 'f1',
    userId: 'user-1234',
    questionId: 'q1',
    targetPeriod: '2026-06-26',
    status: 'failed',
    generationId: null,
    errorMessage: 'model: claude-sonnet-4-20250514',
    createdAt: '2026-06-26T18:00:00.000Z',
    updatedAt: '2026-06-26T18:00:00.000Z',
    userEmail: 'a@example.com',
    questionText: 'Q',
    cost: null,
    masked: false,
    worksheet: null,
    snippets: [],
    letter: null,
    keywords: [],
    scannedEntries: [],
    ...overrides,
  };
}

describe('FermentationDetailHeader retry feedback', () => {
  it('成功時に「再生成しました」を表示する', async () => {
    const onRetry = vi.fn().mockResolvedValue(true);
    render(<FermentationDetailHeader data={makeData()} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('再生成しました')).toBeTruthy();
  });

  it('失敗時に「再生成に失敗しました」を表示する (従来は無反応だった)', async () => {
    const onRetry = vi.fn().mockResolvedValue(false);
    render(<FermentationDetailHeader data={makeData()} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

    expect(await screen.findByText(/再生成に失敗しました/)).toBeTruthy();
  });

  it('例外時もエラー表示する', async () => {
    const onRetry = vi.fn().mockRejectedValue(new Error('network down'));
    render(<FermentationDetailHeader data={makeData()} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));

    expect(await screen.findByText(/再生成に失敗しました/)).toBeTruthy();
  });

  it('failed 以外では Retry ボタンを出さない', () => {
    render(<FermentationDetailHeader data={makeData({ status: 'completed' })} onRetry={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Retry/i })).toBeNull();
  });
});
