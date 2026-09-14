import { INLINE_IMAGE_PLACEHOLDER } from '@oryzae/shared';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpEntryEditor } from '@/features/sp/entries/components/sp-entry-editor';
import jaMessages from '@/i18n/messages/ja.json';
import type { ApiClient } from '@/lib/api';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const P = INLINE_IMAGE_PLACEHOLDER;

/** 本文（contentEditable）。 */
function bodyEditor(): HTMLElement {
  return screen.getByRole('textbox', { name: jaMessages.sp.editor.body_placeholder });
}

function jsonResponse(body: unknown, ok = true): Response {
  // @type-assertion-allowed: テスト用の最小限 Response スタブ
  return { ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response;
}

function api(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

describe('SpEntryEditor: 本文の中の写真と、削除の席', () => {
  let apiFetch: ReturnType<typeof vi.fn>;
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    apiFetch = vi.fn().mockResolvedValue(jsonResponse([]));
  });

  it('PC で本文の中に置いた写真（effects.inlineImages）を同じ位置に出す', () => {
    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor
          api={api(apiFetch)}
          initialEntryId="e1"
          initialContent={`題\n前の文${P}後の文`}
          initialEffects={{
            version: 1,
            inlineImages: [
              {
                offset: 3,
                storagePath: 'p/1.jpg',
                widthRatio: 0.4,
                layout: 'inline',
                align: 'start',
              },
            ],
          }}
          initialMediaUrls={['p/1.jpg']}
          initialMediaSignedUrls={['https://signed/1']}
          persistDraft={false}
        />
      </NextIntlClientProvider>,
    );
    expect(
      screen.getByPlaceholderText<HTMLInputElement>(jaMessages.sp.editor.title_placeholder).value,
    ).toBe('題');
    const body = bodyEditor();
    expect(body.textContent).toBe('前の文後の文');
    const img = body.querySelector('img.inline-photo');
    expect(img?.getAttribute('src')).toBe('https://signed/1');
    // 本文の中の、プレースホルダの位置（「前の文」の直後）
    expect(img?.previousSibling?.textContent).toBe('前の文');
    // 本文の中に居るので、下の写真の並び（旧形式）には出ない
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('effects が無いエントリの添付写真は、今までどおり本文の下に積む', () => {
    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor
          api={api(apiFetch)}
          initialEntryId="e1"
          initialContent="題\n本文"
          initialMediaUrls={['p/old.jpg']}
          initialMediaSignedUrls={['https://signed/old']}
          persistDraft={false}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByRole('list')).toBeTruthy();
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
  });

  it('本文の中の写真を選んでパレットの「外す」で抜くと、写真の無い保存が飛ぶ', async () => {
    const fetchImpl = vi.fn((url: string, _init?: RequestInit) => {
      if (url === '/api/v1/entries/e1') return Promise.resolve(jsonResponse({ id: 'e1' }));
      return Promise.resolve(jsonResponse([]));
    });
    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor
          api={api(fetchImpl)}
          initialEntryId="e1"
          initialContent={`題\n前${P}後`}
          initialEffects={{
            version: 1,
            inlineImages: [
              { offset: 1, storagePath: 'p/1.jpg', widthRatio: 1, layout: 'block', align: 'start' },
            ],
          }}
          initialMediaUrls={['p/1.jpg']}
          initialMediaSignedUrls={['https://signed/1']}
          persistDraft={false}
        />
      </NextIntlClientProvider>,
    );
    const img = bodyEditor().querySelector('img.inline-photo');
    if (!img) throw new Error('本文の中の写真が無い');
    fireEvent.click(img);
    fireEvent.click(await screen.findByRole('button', { name: jaMessages.sp.editor.photo_remove }));
    await waitFor(() => {
      expect(bodyEditor().querySelector('img')).toBeNull();
      expect(bodyEditor().textContent).toBe('前後');
    });
    await waitFor(() => {
      const put = fetchImpl.mock.calls.find(
        (call) => call[0] === '/api/v1/entries/e1' && call[1]?.method === 'PUT',
      );
      expect(put).toBeTruthy();
      const payload = JSON.parse(String(put?.[1]?.body));
      expect(payload.content).toBe('題\n前後');
      expect(payload.mediaUrls).toEqual([]);
      expect(payload.effects).toBeNull();
    });
  });

  it('回り込みの写真の寄せは左右を行き来する（中央は文字の流れる側が無い）', () => {
    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor
          api={api(apiFetch)}
          initialEntryId="e1"
          initialContent={`題\n前${P}後`}
          initialEffects={{
            version: 1,
            inlineImages: [
              {
                offset: 1,
                storagePath: 'p/1.jpg',
                widthRatio: 0.4,
                layout: 'wrap',
                align: 'start',
              },
            ],
          }}
          initialMediaUrls={['p/1.jpg']}
          initialMediaSignedUrls={['https://signed/1']}
          persistDraft={false}
        />
      </NextIntlClientProvider>,
    );
    const img = bodyEditor().querySelector<HTMLImageElement>('img.inline-photo');
    if (!img) throw new Error('本文の中の写真が無い');
    fireEvent.click(img);
    const align = () => {
      const button = document.querySelector('[data-palette-action="photo-align"]');
      if (!(button instanceof HTMLElement)) throw new Error('寄せのボタンが無い');
      return button;
    };
    fireEvent.click(align());
    expect(img.dataset.align).toBe('end');
    fireEvent.click(align());
    expect(img.dataset.align).toBe('start');
  });

  it('削除はパレットに無く、右上の設定シートの末尾から確認して消す → 書斎へ', async () => {
    const fetchImpl = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/v1/entries/e1' && init?.method === 'DELETE')
        return Promise.resolve(jsonResponse({}));
      return Promise.resolve(jsonResponse([]));
    });
    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor
          api={api(fetchImpl)}
          initialEntryId="e1"
          initialContent="題\n本文"
          persistDraft={false}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole('button', { name: jaMessages.sp.editor.delete })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.editor.settings_title }));
    fireEvent.click(
      await screen.findByRole('button', { name: jaMessages.sp.editor.settings_delete_entry }),
    );
    fireEvent.click(
      await screen.findByRole('button', { name: jaMessages.entries.delete_modal.confirm }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('端末の写しがサーバーより新しければ写しから始め、自動保存で送る', async () => {
    window.localStorage.setItem(
      'oryzae:entry-copy:e1',
      JSON.stringify({
        entryId: 'e1',
        content: '題\n電波の無い場所で書き足した',
        mediaUrls: [],
        inlinePaths: [],
        updatedAt: Date.parse('2026-09-14T01:00:00.000Z'),
      }),
    );
    const fetchImpl = vi.fn((url: string, _init?: RequestInit) => {
      if (url === '/api/v1/entries/e1') return Promise.resolve(jsonResponse({ id: 'e1' }));
      return Promise.resolve(jsonResponse([]));
    });
    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor
          api={api(fetchImpl)}
          initialEntryId="e1"
          initialContent="題\n本文"
          initialUpdatedAt="2026-09-14T00:00:00.000Z"
        />
      </NextIntlClientProvider>,
    );
    expect(bodyEditor().textContent).toBe('電波の無い場所で書き足した');
    expect(screen.getByText(jaMessages.sp.editor.status_editing)).toBeTruthy();
    await waitFor(
      () => {
        const put = fetchImpl.mock.calls.find(
          (call) => call[0] === '/api/v1/entries/e1' && call[1]?.method === 'PUT',
        );
        expect(put).toBeTruthy();
      },
      { timeout: 4000 },
    );
  });
});
