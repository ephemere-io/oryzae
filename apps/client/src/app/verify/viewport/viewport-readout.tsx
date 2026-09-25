'use client';

import { useEffect, useState } from 'react';

/**
 * その端末・そのブラウザが返すビューポートの値を並べて見せる（プレビュー限定）。
 *
 * ブラウザによって、`100svh` が実際の表示領域より大きいことがある（実機の Dia では
 * `100svh = 793` に対して `innerHeight = 100dvh = 717`）。どの値が当てになるのかは
 * 端末で実際に測るしかないので、実機で開いて読むための画面。
 *
 * 画面のいちばん下に帯を敷いてある。**帯が全部見えていれば**、このブラウザは
 * 見えている領域を正しく教えている。
 */
export function ViewportReadout() {
  const [rows, setRows] = useState<[string, string][]>([]);

  useEffect(() => {
    const read = () => {
      const viewport = window.visualViewport;
      setRows([
        ['window.innerHeight', `${window.innerHeight}`],
        ['document.documentElement.clientHeight', `${document.documentElement.clientHeight}`],
        ['screen.height / width', `${window.screen.height} / ${window.screen.width}`],
        ['visualViewport.height', viewport ? `${Math.round(viewport.height)}` : '(無し)'],
        ['visualViewport.offsetTop', viewport ? `${Math.round(viewport.offsetTop)}` : '(無し)'],
        ['visualViewport.scale', viewport ? `${viewport.scale}` : '(無し)'],
        ['100svh', `${probe('100svh')}`],
        ['100dvh', `${probe('100dvh')}`],
        ['100lvh', `${probe('100lvh')}`],
        ['min(100svh, 100dvh)（認証画面が使う）', `${probe('min(100svh, 100dvh)')}`],
        ['env(safe-area-inset-bottom)', `${probe('env(safe-area-inset-bottom)')}`],
        ['scrollHeight', `${document.documentElement.scrollHeight}`],
        ['devicePixelRatio', `${window.devicePixelRatio}`],
      ]);
    };
    read();
    window.visualViewport?.addEventListener('resize', read);
    window.visualViewport?.addEventListener('scroll', read);
    window.addEventListener('resize', read);
    return () => {
      window.visualViewport?.removeEventListener('resize', read);
      window.visualViewport?.removeEventListener('scroll', read);
      window.removeEventListener('resize', read);
    };
  }, []);

  return (
    <div className="min-h-[min(100svh,100dvh)] bg-[#f9f8f4] p-5 text-[13px] text-[#2d2d2d]">
      <h1 className="mb-3 text-[15px] font-medium">ビューポートの実測</h1>
      <table className="w-full border-collapse">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label} className="border-[rgba(0,0,0,0.08)] border-b">
              <th className="py-1 text-left font-normal">{label}</th>
              <td className="py-1 text-right font-mono">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-4 leading-relaxed text-[#8c857e]">
        下の帯が全部見えていれば、このブラウザは見えている領域を正しく教えています。
        帯が欠けていれば、その分だけツールバーが重なっています。
      </p>
      <div className="fixed right-0 bottom-0 left-0 flex h-10 items-center justify-center bg-[#5a7c6a] text-[12px] text-white">
        ここが画面のいちばん下（高さ 40px の帯）
      </div>
    </div>
  );
}

/** CSS の値をブラウザに計算させて px で読む。 */
function probe(value: string): number {
  const element = document.createElement('div');
  element.style.cssText = `position:fixed;left:-9999px;top:0;width:1px;height:${value}`;
  document.body.append(element);
  const height = Math.round(element.getBoundingClientRect().height);
  element.remove();
  return height;
}
