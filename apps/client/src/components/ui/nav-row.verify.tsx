/**
 * NavRow の検証スペック。
 *
 * 見張るのは「**同じ役目の行が、どこでも同じ形で出る**」こと。左のサイドバーと発酵の面が
 * 別々に行を組み直すと、選ばれている印や畳んだときの姿がそのつどずれていく。
 */
import { registerUnit } from '@oryzae/verify';
import { NavRow } from './nav-row';

interface Props {
  active: boolean;
  collapsed: boolean;
  kind: 'link' | 'button' | 'external';
  badge?: boolean;
}

const ICON = (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
    className="h-5 w-5"
  >
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);

registerUnit<Props>({
  id: 'NavRow',
  title: 'NavRow',
  description: '行き先を1つ表す行。サイドバーと発酵の面が共有する。',
  kind: 'component',
  render: (props) => (
    <div className="w-60 p-6" style={{ background: 'var(--surface-sunken)' }}>
      <NavRow
        icon={ICON}
        label="一覧"
        active={props.active}
        collapsed={props.collapsed}
        href={props.kind === 'button' ? undefined : '/entries'}
        external={props.kind === 'external'}
        badge={
          props.badge ? (
            <span className="absolute -top-1.5 -right-2 h-4 w-4 rounded-full bg-[#D4714E]" />
          ) : undefined
        }
      />
    </div>
  ),
  fixtures: [
    {
      id: 'link-idle',
      probe: true,
      description: 'アプリ内の行き先。いまここにはいない',
      props: { active: false, collapsed: false, kind: 'link' },
    },
    {
      id: 'link-active',
      description: 'いまここにいる',
      props: { active: true, collapsed: false, kind: 'link' },
    },
    {
      id: 'collapsed',
      description: '畳んでいる — アイコンだけ。名前は aria から読める',
      props: { active: false, collapsed: true, kind: 'link' },
    },
    {
      id: 'collapsed-active-badge',
      description: '畳んでいて、選ばれていて、印が付いている',
      props: { active: true, collapsed: true, kind: 'link', badge: true },
    },
    {
      id: 'button',
      description: '面の中の切り替え（URL を持たない）',
      props: { active: true, collapsed: false, kind: 'button' },
    },
    {
      id: 'external',
      description: 'アプリの外へ出る（新しいタブ）',
      props: { active: false, collapsed: false, kind: 'external' },
    },
  ],
  invariants: [
    {
      id: 'label-always-reachable',
      description: '畳んでいても名前に辿り着ける（字が消えるなら aria-label と title が残る）',
      check: ({ root, contract }) => {
        const row = root.querySelector('[data-verify-unit="NavRow"]');
        if (!row) return 'row not found';
        if (contract.collapsed !== 'true') {
          return row.textContent?.includes('一覧') || 'expected the label to be visible';
        }
        const label = row.getAttribute('aria-label');
        const title = row.getAttribute('title');
        return (
          (label === '一覧' && title === '一覧') || 'expected aria-label and title when collapsed'
        );
      },
    },
    {
      id: 'active-is-announced',
      description: '選ばれていることが、色だけでなく属性でも伝わる',
      check: ({ root, contract }) => {
        const row = root.querySelector('[data-verify-unit="NavRow"]');
        if (!row) return 'row not found';
        if (contract.active !== 'true') return true;
        const announced =
          row.getAttribute('aria-current') === 'page' ||
          row.getAttribute('aria-pressed') === 'true';
        return announced || 'expected aria-current or aria-pressed on the active row';
      },
    },
    {
      id: 'external-opens-safely',
      description: '外へ出るリンクは rel を付ける（開いた先から元のタブを触らせない）',
      onlyFixtures: ['external'],
      check: ({ root }) => {
        const row = root.querySelector('a[target="_blank"]');
        if (!row) return 'expected an anchor opening in a new tab';
        const rel = row.getAttribute('rel') ?? '';
        return rel.includes('noopener') || `expected rel to include noopener, got "${rel}"`;
      },
    },
  ],
});
