import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';

/**
 * Issue #357: ローディング/エラー/empty ステートの共通コンポーネント。
 * EmptyState / ErrorState の基本的な描画・操作を検証する（Skeleton は #378 で導入済み）。
 */
describe('EmptyState / ErrorState (Issue #357)', () => {
  afterEach(() => cleanup());

  it('EmptyState はメッセージを描画する', () => {
    render(<EmptyState message="エントリーはまだありません" />);
    expect(screen.getByTestId('empty-state')).toBeTruthy();
    expect(screen.getByText('エントリーはまだありません')).toBeTruthy();
  });

  it('ErrorState はメッセージを描画し、onRetry を渡すと再試行ボタンを出す', () => {
    const onRetry = vi.fn();
    render(
      <ErrorState message="読み込みに失敗しました" onRetry={onRetry} retryLabel="再読み込み" />,
    );
    expect(screen.getByTestId('error-state')).toBeTruthy();
    expect(screen.getByText('読み込みに失敗しました')).toBeTruthy();

    fireEvent.click(screen.getByText('再読み込み'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('ErrorState は onRetry 未指定なら再試行ボタンを出さない', () => {
    render(<ErrorState message="読み込みに失敗しました" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
