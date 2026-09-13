/**
 * SpBodyEditor の検証スペック。
 *
 * 見るのは: 文の数 = 写真の数 + 1、写真は全幅のブロック、× か直後の文の先頭の BackSpace で抜けて
 * 前後の文が繋がる。
 */

import { INLINE_IMAGE_PLACEHOLDER } from '@oryzae/shared';
import { registerUnit } from '@oryzae/verify';
import { useState } from 'react';
import type { InlinePhoto } from '@/features/shared/entries/types';
import {
  joinBodySegments,
  removePhotoAt,
  splitBodyAtPhotos,
} from '@/features/shared/entries/utils/inline-photos';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpBodyEditor } from './sp-body-editor';

interface Props {
  value: string;
  images: InlinePhoto[];
}

const P = INLINE_IMAGE_PLACEHOLDER;
const PIXEL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="%23d9b48f"/></svg>';

function Harness({ value: initial, images: initialImages }: Props) {
  const [value, setValue] = useState(initial);
  const [images, setImages] = useState(initialImages);
  const [selected, setSelected] = useState<number | null>(null);
  return (
    <div style={{ width: 390 }}>
      <SpBodyEditor
        value={value}
        images={images}
        onChange={setValue}
        onRemoveImage={(index) => {
          setImages((prev) => prev.filter((_, i) => i !== index));
          setValue((prev) => joinBodySegments(removePhotoAt(splitBodyAtPhotos(prev), index)));
        }}
        selectedImage={selected}
        onSelectImage={setSelected}
        placeholder="いま感じていることを、そのまま。"
        ariaLabel="本文"
        style={{ fontFamily: "'Noto Serif JP', serif", fontSize: 16, lineHeight: 1.9 }}
      />
    </div>
  );
}

registerUnit<Props>({
  id: 'SpBodyEditor',
  title: 'SpBodyEditor',
  description: 'SP の本文（文のブロックと写真のブロックの列）',
  kind: 'component',
  render: (props) => withVerifyProviders(<Harness {...props} />),
  fixtures: [
    {
      id: 'text-only',
      description: '写真なし（textarea 1 つ）',
      props: { value: '今日は雨。', images: [] },
    },
    {
      id: 'with-photos',
      description: '写真 2 枚が文の間に',
      props: {
        value: `朝の光。\n${P}昼はよく歩いた。\n${P}`,
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
            layout: 'block',
            align: 'end',
          },
        ],
      },
    },
    {
      id: 'photo-unavailable',
      description: '署名できなかった写真は枠だけ残す',
      props: {
        value: `前${P}後`,
        images: [
          { storagePath: 'p/x.jpg', signedUrl: '', widthRatio: 1, layout: 'block', align: 'start' },
        ],
      },
    },
    {
      id: 'remove-by-button',
      probe: true,
      description: 'Probe: × で写真を抜くと前後の文が 1 つに繋がる',
      props: {
        value: `前${P}後`,
        images: [
          {
            storagePath: 'p/1.jpg',
            signedUrl: PIXEL,
            widthRatio: 1,
            layout: 'block',
            align: 'start',
          },
        ],
      },
      act: async (ctx) => {
        await ctx.click('figure button[aria-label^="1 枚目の写真を削除"]');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'segments-are-images-plus-one',
      description: '文（textarea）の数は写真の数 + 1',
      check: ({ root, contract }) => {
        const areas = root.querySelectorAll('textarea').length;
        const figures = root.querySelectorAll('figure').length;
        return (
          (areas === figures + 1 && String(figures) === contract.imageCount) ||
          `textarea ${areas} / 写真 ${figures}（契約 ${contract.imageCount}）`
        );
      },
    },
    {
      id: 'removed-merges',
      description: '× のあとは写真が無く、文が 1 つ',
      onlyFixtures: ['remove-by-button'],
      check: ({ root }) => {
        const areas = root.querySelectorAll<HTMLTextAreaElement>('textarea');
        return (
          (areas.length === 1 && areas[0]?.value === '前\n後') ||
          `textarea ${areas.length} 件、値 ${JSON.stringify(areas[0]?.value)}`
        );
      },
    },
  ],
});
