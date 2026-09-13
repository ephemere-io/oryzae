import { INLINE_IMAGE_PLACEHOLDER } from '@oryzae/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InlinePhoto } from '@/features/shared/entries/types';
import { SpBodyEditor } from '@/features/sp/entries/components/sp-body-editor';
import jaMessages from '@/i18n/messages/ja.json';

const P = INLINE_IMAGE_PLACEHOLDER;

/** n 番目の文（textarea）。無ければ落とす（`as` を使わずに絞る）。 */
function segment(index: number): HTMLTextAreaElement {
  const el = screen.getAllByRole<HTMLTextAreaElement>('textbox')[index];
  if (!el) throw new Error(`textarea ${index} が無い`);
  return el;
}

/** 本文の中の 1 枚（SP の既定の見た目）。 */
function photo(storagePath: string, signedUrl: string): InlinePhoto {
  return { storagePath, signedUrl, widthRatio: 1, layout: 'block', align: 'start' };
}

function setup(value: string, images: InlinePhoto[]) {
  const onChange = vi.fn();
  const onRemoveImage = vi.fn();
  render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <SpBodyEditor
        value={value}
        images={images}
        onChange={onChange}
        onRemoveImage={onRemoveImage}
        selectedImage={null}
        onSelectImage={() => {}}
        placeholder="本文"
        ariaLabel="本文"
        style={{ fontFamily: 'serif' }}
      />
    </NextIntlClientProvider>,
  );
  return { onChange, onRemoveImage };
}

describe('SpBodyEditor（文のブロックと写真のブロックの列）', () => {
  afterEach(cleanup);

  it('写真が無ければ textarea 1 つで、プレースホルダを出す', () => {
    setup('今日は雨。', []);
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByPlaceholderText('本文')).toBeTruthy();
  });

  it('写真 1 枚なら textarea 2 つの間に写真が入る', () => {
    setup(`前${P}後`, [photo('p/1.jpg', 'https://signed/1')]);
    const areas = screen.getAllByRole<HTMLTextAreaElement>('textbox');
    expect(areas.map((a) => a.value)).toEqual(['前', '後']);
    expect(document.querySelector('figure img')?.getAttribute('src')).toBe('https://signed/1');
  });

  it('文を書き換えると、写真の位置を保った本文で onChange する', () => {
    const { onChange } = setup(`前${P}後`, [photo('p/1.jpg', 'x')]);
    fireEvent.change(segment(1), { target: { value: '後ろに足した' } });
    expect(onChange).toHaveBeenCalledWith(`前${P}後ろに足した`);
  });

  it('写真の直後の文の先頭で BackSpace すると写真を抜く（Notion と同じ）', () => {
    const { onRemoveImage, onChange } = setup(`前${P}後`, [photo('p/1.jpg', 'x')]);
    const second = segment(1);
    second.focus();
    second.setSelectionRange(0, 0);
    fireEvent.keyDown(second, { key: 'Backspace' });
    expect(onRemoveImage).toHaveBeenCalledWith(0);
    // 本文の繋ぎ直しは呼び出し側が行う（ここでは onChange しない）
    expect(onChange).not.toHaveBeenCalled();
  });

  it('文の途中の BackSpace は普通の削除（写真を抜かない）', () => {
    const { onRemoveImage } = setup(`前${P}後`, [photo('p/1.jpg', 'x')]);
    const second = segment(1);
    second.focus();
    second.setSelectionRange(1, 1);
    fireEvent.keyDown(second, { key: 'Backspace' });
    expect(onRemoveImage).not.toHaveBeenCalled();
  });

  it('× でも写真を抜く', () => {
    const { onRemoveImage } = setup(`前${P}後`, [photo('p/1.jpg', 'x')]);
    fireEvent.click(
      screen.getByRole('button', { name: jaMessages.photo.remove.replace('{index}', '1') }),
    );
    expect(onRemoveImage).toHaveBeenCalledWith(0);
  });

  it('署名できなかった写真は枠だけ残す（index がずれない）', () => {
    setup(`前${P}後`, [photo('p/1.jpg', '')]);
    expect(screen.getByRole('img', { name: jaMessages.photo.unavailable_short })).toBeTruthy();
  });
});
