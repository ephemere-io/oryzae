/**
 * Sidebar の検証スペック（A 移植・auth スライス）。
 *
 * Sidebar は props seam を持たず、状態はすべて hook 由来:
 *  - usePathname … アクティブ項目のハイライト分岐（唯一の意味あるロジック）
 *  - useTheme / useUnread / useSidebarVisibility … いずれも createContext の既定値を持つ
 *    （provider 不在でも crash せず theme=light / unreadCount=0 / hidden=false に落ちる）
 *  - useAuth … context ではないが、jsdom では getAccessToken()=null で effect が即 return し
 *    auth=null のまま（fetch しない）。よってアバターは "?" フォールバックに固定。
 *
 * 唯一の状態 seam は pathname。withVerifyProviders の内側に PathnameContext.Provider を
 * 重ねて fixture ごとに上書きする（内側 provider が土台の "/verify" に勝つ）。
 * 公表する契約は「変化するもの」だけ: root の pathname と、各ナビ Link の navItem/active。
 * theme / unreadCount / hidden / auth は既定値に固定され変化しないため契約に載せない。
 *
 * Probe は /entries の完全一致特例（sidebar.tsx の isActive 分岐）。/entries/new では素朴な
 * startsWith なら List(/entries) と Editor(/entries/new) が両方点灯するが、特例が List を抑止し
 * Editor だけがアクティブになる。これが崩れる回帰を捕まえる。
 *
 * i18n（sidebar.nav.account）依存のため withVerifyProviders（NextIntlClientProvider）で包む。
 */

import { registerUnit } from '@oryzae/verify';
import { PathnameContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { SidebarProvider } from '@/lib/sidebar-context';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { Sidebar } from './sidebar';

interface Props {
  pathname: string;
  /** 畳んだ状態（アイコンだけ）か、開いた状態（アイコン + メニュー名）か。 */
  collapsed?: boolean;
}

// pathname から「どの navItem がアクティブであるべきか」を計算する（sidebar.tsx の isActive と同型）。
// '/entries' は完全一致、それ以外は startsWith。
function expectedActiveMatch(pathname: string): string | null {
  const items = ['/jar', '/board', '/entries', '/entries/new'];
  // 完全一致の /entries/new を startsWith の /entries より優先するため、長いものから判定する。
  for (const match of ['/entries/new', '/jar', '/board', '/entries']) {
    const isActive = match === '/entries' ? pathname === '/entries' : pathname.startsWith(match);
    if (isActive && items.includes(match)) return match;
  }
  return null;
}

registerUnit<Props>({
  id: 'Sidebar',
  title: 'Sidebar',
  description: 'グラスモーフィズムの縦型ナビ（pathname でアクティブ項目をハイライト）。',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <PathnameContext.Provider value={props.pathname}>
        {/* 開閉は context 由来。persist=false にして、fixture 間で localStorage を漏らさない。 */}
        <SidebarProvider initialCollapsed={props.collapsed ?? true} persist={false}>
          <Sidebar />
        </SidebarProvider>
      </PathnameContext.Provider>,
    ),
  fixtures: [
    {
      id: 'jar-active',
      description: '/jar では Jar がアクティブ（active=true は Jar のみ）',
      props: { pathname: '/jar' },
    },
    {
      id: 'entries-active',
      description: '/entries では List がアクティブ・Editor は非アクティブ（完全一致特例）',
      props: { pathname: '/entries' },
    },
    {
      id: 'no-active',
      description: 'どのナビにもマッチしないパスではアクティブ項目ゼロ',
      props: { pathname: '/account' },
    },
    {
      id: 'expanded',
      description: '開いた状態 — 各項目にアイコンとメニュー名が並ぶ',
      props: { pathname: '/jar', collapsed: false },
    },
    {
      id: 'editor-not-list',
      probe: true,
      description:
        'Probe: /entries/new では Editor だけがアクティブ。startsWith なら List も点灯するが完全一致特例が抑止する',
      props: { pathname: '/entries/new' },
    },
  ],
  invariants: [
    {
      id: 'pathname-contract-matches',
      description: 'root の data-verify-pathname が注入した pathname と一致する',
      check: ({ contract, props }) =>
        contract.pathname === props.pathname ||
        `contract.pathname="${contract.pathname}", expected "${props.pathname}"`,
    },
    {
      id: 'exactly-expected-link-active',
      description:
        'pathname から計算したナビ項目だけが active=true（ハイライトが pathname と一致する）',
      check: ({ root, props }) => {
        const links = Array.from(root.querySelectorAll<HTMLElement>('[data-verify-nav-item]'));
        const active = links.filter((l) => l.getAttribute('data-verify-active') === 'true');
        const expected = expectedActiveMatch(props.pathname);
        if (expected === null) {
          return (
            active.length === 0 ||
            `expected no active item for "${props.pathname}", got ${active.length}`
          );
        }
        if (active.length !== 1) {
          return `expected exactly 1 active item for "${props.pathname}", got ${active.length}`;
        }
        const activeMatch = active[0]?.getAttribute('data-verify-nav-item');
        return (
          activeMatch === expected || `expected active navItem "${expected}", got "${activeMatch}"`
        );
      },
    },
    {
      id: 'jar-is-first',
      // 最初に目に入るべきは「書いたものが納まっている場所」。ロゴは行き先ではない。
      description: '行き先の先頭は瓶（ロゴを列の先頭に置かない）',
      check: ({ root }) => {
        const first = root.querySelector('[data-verify-nav-item]');
        const match = first?.getAttribute('data-verify-nav-item');
        return match === '/jar' || `先頭が "${match}"（瓶であるべき）`;
      },
    },
    {
      id: 'labels-follow-collapsed',
      description: '畳んでいるときはメニュー名を出さず、開いているときは全ての行に出す',
      check: ({ root, contract }) => {
        // 行き先だけでなく、下にまとめた「使い方」「アカウント」も同じ規則に従う。
        const rows = Array.from(root.querySelectorAll<HTMLElement>('nav a'));
        // アイコンの span に加えて名前の span があるか（畳んでいるときは1つだけ）。
        const withLabel = rows.filter((l) => l.querySelectorAll(':scope > span').length > 1);
        const expected = contract.collapsed === 'true' ? 0 : rows.length;
        return (
          withLabel.length === expected ||
          `名前つき=${withLabel.length}, 期待=${expected}（collapsed=${contract.collapsed}）`
        );
      },
    },
    {
      id: 'help-leaves-the-app',
      // 使い方は別ドメインの公開サイトにある（Issue #532）。相対パスで書くとアプリ内で
      // 404 になるので、絶対 URL で新しいタブに開くことを固定する。
      description: '「使い方」は公開サイトへ、新しいタブで出る',
      check: ({ root }) => {
        const help = root.querySelector<HTMLAnchorElement>('nav a[target="_blank"]');
        if (!help) return '公開サイトへのリンクが無い';
        if (!/^https?:\/\//.test(help.getAttribute('href') ?? '')) {
          return `href が絶対 URL でない: "${help.getAttribute('href')}"`;
        }
        return (
          (help.getAttribute('rel') ?? '').includes('noopener') ||
          'rel に noopener が無い（新しいタブに開くリンクには必須）'
        );
      },
    },
    {
      id: 'no-wordmark-in-nav',
      // ロゴは名乗りであって行き先ではない。列に混ぜると押せるものに見える。
      description: 'サイドバーに名乗り（Oryzae）を置かない',
      check: ({ root }) => {
        const nav = root.querySelector('nav');
        const text = nav?.textContent ?? '';
        return !/Oryzae/i.test(text) || 'サイドバーに "Oryzae" の文字が残っている';
      },
    },
    {
      id: 'avatar-fallback-when-unauthed',
      description: '未認証（auth=null）ではアバターが "?" フォールバックを表示する',
      check: ({ root }) => {
        const accountLink = root.querySelector('a[href="/account"]');
        const fallback = accountLink?.querySelector('span');
        return (
          fallback?.textContent === '?' ||
          `expected "?" avatar fallback, got "${fallback?.textContent}"`
        );
      },
    },
  ],
});
