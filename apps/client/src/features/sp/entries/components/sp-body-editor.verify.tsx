/**
 * SpBodyEditor の検証スペック。
 *
 * 見るのは: 写真は本文の中の `<img>`（数は本文のプレースホルダの数と同じ）、回り込みは float、
 * 押した写真に縁取り、空の本文に案内。指で掴んで動かすのは実機（caretRangeFromPoint が要る）。
 */

import { INLINE_IMAGE_PLACEHOLDER } from '@oryzae/shared';
import { registerUnit } from '@oryzae/verify';
import { useState } from 'react';
import type { InlinePhoto } from '@/features/shared/entries/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpBodyEditor } from './sp-body-editor';

interface Props {
  body: string;
  images: InlinePhoto[];
}

const P = INLINE_IMAGE_PLACEHOLDER;
const PIXEL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="%23d9b48f"/></svg>';

function Harness({ body, images }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div style={{ width: 390 }}>
      <SpBodyEditor
        initialBody={body}
        initialImages={images}
        onChange={() => {}}
        selectedImage={selected}
        onSelectImage={setSelected}
        placeholder="いま感じていることを、そのまま。"
        ariaLabel="本文"
        style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 16, lineHeight: 1.9 }}
      />
    </div>
  );
}

const LONG =
  '昼はよく歩いた。川沿いの道は風が強くて、帽子を押さえながら橋を二つ渡った。帰りにパン屋に寄ると、いつもの丸いパンが売り切れていた。';

registerUnit<Props>({
  id: 'SpBodyEditor',
  title: 'SpBodyEditor',
  description: 'SP の本文（contentEditable。写真は本文の中、回り込み・掴んで移動）',
  kind: 'component',
  render: (props) => withVerifyProviders(<Harness {...props} />),
  fixtures: [
    {
      id: 'empty',
      description: '空の本文は案内を出す',
      props: { body: '', images: [] },
    },
    {
      id: 'text-only',
      description: '写真なし',
      props: { body: '今日は雨。', images: [] },
    },
    {
      id: 'with-photos',
      description: '全幅の写真と、右に寄せて回り込ませた小さい写真',
      props: {
        body: `朝の光。\n${P}${P}${LONG}${LONG}`,
        images: [
          {
            storagePath: 'p/1.jpg',
            signedUrl: PIXEL,
            widthRatio: 1,
            layout: 'block',
            align: 'start',
          },
          {
            storagePath: 'p/2.jpg',
            signedUrl: PIXEL,
            widthRatio: 0.4,
            layout: 'wrap',
            align: 'end',
          },
        ],
      },
    },
    {
      id: 'photo-unavailable',
      description: '署名できなかった写真は枠だけ残す',
      props: {
        body: `前${P}後`,
        images: [
          { storagePath: 'p/x.jpg', signedUrl: '', widthRatio: 1, layout: 'block', align: 'start' },
        ],
      },
    },
    {
      id: 'select-photo',
      probe: true,
      description: 'Probe: 写真を押すと選ばれ、縁取りが付く',
      props: {
        body: `前${P}後`,
        images: [
          {
            storagePath: 'p/1.jpg',
            signedUrl: PIXEL,
            widthRatio: 0.7,
            layout: 'wrap',
            align: 'start',
          },
        ],
      },
      act: async (ctx) => {
        await ctx.click('img.inline-photo');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'photos-in-body',
      description: '写真は本文の中の <img>（数は本文のプレースホルダの数と同じ）',
      check: ({ root, props }) => {
        const body = root.querySelector('[data-sp-body]');
        const photos = body?.querySelectorAll('img.inline-photo').length ?? -1;
        const expected = [...props.body].filter((ch) => ch === P).length;
        return photos === expected || `本文の中の写真 ${photos} 枚（期待 ${expected}）`;
      },
    },
    {
      id: 'wrap-is-float',
      description: '回り込みの写真は float（文字が横を流れる）、それ以外は float しない',
      check: ({ root }) => {
        for (const img of root.querySelectorAll<HTMLImageElement>('img.inline-photo')) {
          const floats = img.style.float !== '' && img.style.float !== 'none';
          if ((img.dataset.layout === 'wrap') !== floats) {
            return `layout=${img.dataset.layout} なのに float=${JSON.stringify(img.style.float)}`;
          }
        }
        return true;
      },
    },
    {
      id: 'selected-outlined',
      description: '選んだ写真だけに縁取りの印',
      check: ({ root, contract }) => {
        const marked = [...root.querySelectorAll('img.inline-photo')].map((img) =>
          img.hasAttribute('data-selected'),
        );
        const expected = contract.selectedImage === 'none' ? -1 : Number(contract.selectedImage);
        return (
          marked.every((on, index) => on === (index === expected)) ||
          `印 ${JSON.stringify(marked)} / 契約 ${contract.selectedImage}`
        );
      },
    },
    {
      id: 'probe-selects',
      description: '押した写真が選ばれている',
      onlyFixtures: ['select-photo'],
      check: ({ contract }) =>
        contract.selectedImage === '0' || `selectedImage=${contract.selectedImage}`,
    },
    {
      id: 'placeholder-when-empty',
      description: '空の本文だけに案内の印',
      check: ({ root, props }) => {
        const empty = root.querySelector<HTMLElement>('[data-sp-body]')?.dataset.empty;
        const expected = String(props.body === '' && props.images.length === 0);
        return empty === expected || `data-empty=${empty}（期待 ${expected}）`;
      },
    },
  ],
});
