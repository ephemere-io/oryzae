import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErrorsView } from '@/features/errors/components/errors-view';
import type { ErrorsData } from '@/features/errors/hooks/use-errors';

afterEach(cleanup);

function makeData(overrides: Partial<ErrorsData> = {}): ErrorsData {
  return {
    status: 'ok',
    missing: [],
    message: null,
    environment: 'production',
    sending: { server: true, browser: true },
    consoleUrl: 'https://oryzae.sentry.io/issues/',
    issues: [],
    daily: [],
    truncated: false,
    ...overrides,
  };
}

describe('ErrorsView', () => {
  it('says there are no unresolved errors only when Sentry was read and DSNs are set', () => {
    render(<ErrorsView data={makeData()} />);

    expect(screen.getByText('未解決のエラーはありません')).toBeTruthy();
    expect(document.querySelector('[data-errors-notice]')).toBeNull();
  });

  // 2026-09 まで DSN 未設定のまま「No unresolved errors」を出していた。届いていないことを
  // 「壊れていない」と読ませない。
  it('warns that errors are not being sent when the DSNs are missing', () => {
    render(<ErrorsView data={makeData({ sending: { server: false, browser: false } })} />);

    const notice = document.querySelector('[data-errors-notice]');
    expect(notice?.textContent).toContain('SENTRY_DSN（サーバー）');
    expect(notice?.textContent).toContain('NEXT_PUBLIC_SENTRY_DSN（ブラウザ）');
  });

  it('names the missing read-side variables and does not claim zero errors', () => {
    render(
      <ErrorsView data={makeData({ status: 'not-configured', missing: ['SENTRY_AUTH_TOKEN'] })} />,
    );

    expect(document.querySelector('[data-errors-notice]')?.textContent).toContain(
      'SENTRY_AUTH_TOKEN',
    );
    expect(screen.queryByText('未解決のエラーはありません')).toBeNull();
  });

  it('shows the API error message from the server', () => {
    render(
      <ErrorsView
        data={makeData({ status: 'error', message: 'Sentry が読み取りを拒否しました (HTTP 403)' })}
      />,
    );

    expect(screen.getByText('Sentry が読み取りを拒否しました (HTTP 403)')).toBeTruthy();
  });

  it('lists each issue with where it happened and a link to Sentry', () => {
    render(
      <ErrorsView
        data={makeData({
          issues: [
            {
              id: '1',
              shortId: 'ORYZAE-1',
              title: 'Error: boom',
              culprit: 'GET /api/v1/board',
              level: 'error',
              count: 29,
              userCount: 2,
              firstSeen: '2026-09-23T00:54:27Z',
              lastSeen: '2026-09-23T16:22:31Z',
              permalink: 'https://oryzae.sentry.io/issues/1/',
              isUnhandled: true,
              isNew: true,
            },
          ],
        })}
      />,
    );

    const row = document.querySelector('[data-issue="ORYZAE-1"]');
    expect(row?.textContent).toContain('Error: boom');
    expect(row?.textContent).toContain('GET /api/v1/board');
    expect(row?.textContent).toContain('新規');
    expect(row?.querySelector('a')?.getAttribute('href')).toBe(
      'https://oryzae.sentry.io/issues/1/',
    );
  });
});
