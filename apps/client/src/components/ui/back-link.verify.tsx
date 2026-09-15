/**
 * BackLink の検証スペック。
 *
 * 「サブ画面から書斎へ戻れる」（40-acceptance.md「ナビゲーション」）の PC 側。
 *
 * 見張るのは**置き場と見え方の約束**。出口は左上（3 巡「既存の操作に被る」）→ 下端
 * （操作パレットの真下）→ 上端の中央から垂れるタブ（どの画面にも属さない札に見える）と
 * 移してきた。いまは**各画面のヘッダーの先頭**。浮かせて席を空けさせる作りに戻ると、
 * また重なりと読み忘れの往復になる。
 *
 * 見た目は隣の「問いを紐づける」と同じボタンで、縁だけ深い緑（オーナーの判断）。
 */

import { registerUnit } from '@oryzae/verify';
import { BackLinkProvider } from '@/lib/back-link-context';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BackLink } from './back-link';
import { ELEVATED_CHIP_CLASS, HEADER_CHIP_CLASS } from './surface';

interface Props {
  placement: 'inline' | 'corner';
}

/**
 * 行き先の絵の代わり。本物（書斎の絵）は features にあり、components からは import できない。
 * ここで見るのは「絵が名前の後ろに付くこと」だけなので、印の付いた空の SVG で足りる。
 */
const ICON = <svg data-verify-icon aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" />;

/** 見える名前の箱（山形・絵ではなく「書斎」の字を持つ span）。 */
function nameOf(root: Element): Element | undefined {
  return [...root.querySelectorAll('a span')].find((s) => s.textContent === '書斎');
}

registerUnit<Props>({
  id: 'BackLink',
  title: 'BackLink',
  description:
    'サブ画面の左上の「‹ 書斎」。問いのチップと同じボタンで、ヘッダーの先頭に並べるか、ヘッダーの無い画面の隅に置く',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <BackLinkProvider value={{ href: '/', label: '書斎', ariaLabel: '書斎に戻る', icon: ICON }}>
        <div className="flex items-center gap-3 p-6">
          <BackLink placement={props.placement} />
        </div>
      </BackLinkProvider>,
    ),
  fixtures: [
    {
      id: 'inline',
      probe: true,
      description: 'Probe: ヘッダーの行に並ぶ（エントリー・ボード）',
      props: { placement: 'inline' },
    },
    {
      id: 'corner',
      description: 'ヘッダーを持たない画面の左上（瓶・問いの変遷・アカウント）',
      props: { placement: 'corner' },
    },
  ],
  invariants: [
    {
      id: 'links-to-target',
      description: '行き先（書斎 /）へ行ける',
      check: ({ root }) =>
        Boolean(root.querySelector('a[href="/"]')) || '行き先（/）へのリンクが無い',
    },
    {
      id: 'says-where-it-goes',
      description: '山形だけにしない（行き先の名前が読める）。読み上げは動作まで言う',
      check: ({ root }) => {
        const link = root.querySelector('a');
        if (!link) return 'リンクが無い';
        if (!(link.textContent ?? '').includes('書斎')) return '行き先の名前が見えない';
        return link.getAttribute('aria-label') === '書斎に戻る' || '読み上げの名前が無い';
      },
    },
    {
      id: 'wears-the-question-chip-with-a-green-edge',
      description: '「問いを紐づける」と同じボタン（寸法と面）で、縁だけ深い緑',
      check: ({ root }) => {
        const link = root.querySelector('a');
        if (!(link instanceof HTMLElement)) return 'リンクが無い';
        const classes = link.className.split(/\s+/);
        const expected = `${HEADER_CHIP_CLASS} ${ELEVATED_CHIP_CLASS}`.split(/\s+/);
        const missing = expected.filter((c) => !classes.includes(c));
        if (missing.length > 0)
          return `問いのチップと同じボタンになっていない: ${missing.join(' ')}`;
        return link.style.borderColor === 'var(--accent)' || '縁が深い緑（--accent）になっていない';
      },
    },
    {
      id: 'icon-follows-the-name',
      description:
        '行き先の絵は名前の後ろ（山形の隣に置くと記号が 2 つ続く）。読み上げには出さない',
      check: ({ root }) => {
        const icon = root.querySelector('[data-verify-icon]');
        const name = nameOf(root);
        if (!icon || !name) return '絵か名前が無い';
        if (!icon.parentElement?.closest('[aria-hidden="true"]')) return '絵が読み上げに出る';
        const follows = name.compareDocumentPosition(icon) & Node.DOCUMENT_POSITION_FOLLOWING;
        return follows !== 0 || '絵が名前より前にある';
      },
    },
    {
      id: 'lifts-the-japanese-name',
      description: '名前を 1px 上げる（日本語の字面は中央揃えだと山形より低く見える）',
      check: ({ root }) =>
        (nameOf(root)?.className ?? '').includes('-top-px') || '名前の上げ（-top-px）が外れている',
    },
    {
      id: 'never-hangs-from-the-center',
      description: '上端の中央に戻さない（どの画面にも属さない札に見える）',
      check: ({ root }) => {
        const classNames = [...root.querySelectorAll('*')]
          .map((el) => el.getAttribute('class') ?? '')
          .join(' ');
        if (classNames.includes('inset-x-0')) return '上端いっぱいに広げている';
        return !classNames.includes('left-1/2') || '中央に寄せている';
      },
    },
  ],
});
