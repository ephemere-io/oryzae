import { render, within } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { BackToStudy } from '@/features/shared/study/components/back-to-study';
import { SidebarProvider, useSidebarVisibility } from '@/lib/sidebar-context';
import { I18nWrapper } from '../../../../helpers/i18n-wrapper';

/** エディタの集中モードの代わり。サイドバーを隠す合図だけを立てる。 */
function FocusMode({ on }: { on: boolean }) {
  const { setHidden } = useSidebarVisibility();
  useEffect(() => setHidden(on), [on, setHidden]);
  return null;
}

function renderTab(focus: boolean) {
  return render(
    <I18nWrapper>
      <SidebarProvider persist={false}>
        <FocusMode on={focus} />
        <BackToStudy />
      </SidebarProvider>
    </I18nWrapper>,
  );
}

// document ではなく**その描画の container** から引く。このリポジトリの vitest は
// テストの間に DOM を片付けないので、document から引くと前のテストの帯を掴む。
function band(container: HTMLElement): HTMLElement {
  const element = container.querySelector('[data-verify-unit="BackToStudy"]');
  if (!(element instanceof HTMLElement)) throw new Error('帯が無い');
  return element;
}

describe('BackToStudy と集中モード', () => {
  it('ふだんは見えていて押せる', () => {
    const { container } = renderTab(false);
    expect(band(container).className).toContain('opacity-100');
    const tab = within(container).getByRole('link');
    expect(tab.className).toContain('pointer-events-auto');
    expect(tab.getAttribute('tabindex')).toBeNull();
  });

  it('集中モードでは消え、押せず、Tab でも止まらない', () => {
    // エディタが書いている間にまわりを消す演出で、タブだけが残っていた（実機レビュー）。
    const { container } = renderTab(true);
    expect(band(container).className).toContain('opacity-0');
    const tab = container.querySelector('a[href="/study"]');
    expect(tab?.className).toContain('pointer-events-none');
    expect(tab?.getAttribute('tabindex')).toBe('-1');
    expect(tab?.getAttribute('aria-hidden')).toBe('true');
  });
});
