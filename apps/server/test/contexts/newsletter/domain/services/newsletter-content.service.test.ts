import { describe, expect, it } from 'vitest';
import {
  buildPreheader,
  escapeHtml,
  parseNewsletterBody,
  renderNewsletterHtml,
  renderNewsletterText,
} from '@/contexts/newsletter/domain/services/newsletter-content.service.js';

describe('parseNewsletterBody', () => {
  it('空行で段落を切る', () => {
    expect(parseNewsletterBody('一行目\n二行目\n\n次の段落')).toEqual([
      { type: 'paragraph', lines: ['一行目', '二行目'] },
      { type: 'paragraph', lines: ['次の段落'] },
    ]);
  });

  it('# の数で見出しレベルを決め、#### 以上は見出しにしない', () => {
    expect(parseNewsletterBody('# A\n## B\n### C')).toEqual([
      { type: 'heading', level: 1, text: 'A' },
      { type: 'heading', level: 2, text: 'B' },
      { type: 'heading', level: 3, text: 'C' },
    ]);
    expect(parseNewsletterBody('#### D')).toEqual([{ type: 'paragraph', lines: ['#### D'] }]);
  });

  it('連続する - を 1 つの箇条書きにまとめる', () => {
    expect(parseNewsletterBody('- 一つ目\n- 二つ目')).toEqual([
      { type: 'list', items: ['一つ目', '二つ目'] },
    ]);
  });

  it('--- は区切り線（3 つ以上の - だけの行）', () => {
    expect(parseNewsletterBody('---')).toEqual([{ type: 'rule' }]);
    // `- ` で始まる行は箇条書き。区切り線と取り違えない。
    expect(parseNewsletterBody('- 項目')).toEqual([{ type: 'list', items: ['項目'] }]);
  });

  it('CRLF でも段落が切れる', () => {
    expect(parseNewsletterBody('A\r\n\r\nB')).toEqual([
      { type: 'paragraph', lines: ['A'] },
      { type: 'paragraph', lines: ['B'] },
    ]);
  });

  it('見出しの直後の箇条書きと段落を取り違えない', () => {
    expect(parseNewsletterBody('## 新機能\n- 一つ目\n続きの文')).toEqual([
      { type: 'heading', level: 2, text: '新機能' },
      { type: 'list', items: ['一つ目'] },
      { type: 'paragraph', lines: ['続きの文'] },
    ]);
  });
});

describe('escapeHtml', () => {
  it('HTML の特殊文字をすべて実体参照にする', () => {
    expect(escapeHtml(`<b>&"'`)).toBe('&lt;b&gt;&amp;&quot;&#39;');
  });
});

describe('renderNewsletterHtml', () => {
  const render = (bodyMarkdown: string, subject = '件名') =>
    renderNewsletterHtml({ subject, bodyMarkdown });

  it('本文に書かれた HTML をそのまま出さない（メールに script を差し込ませない）', () => {
    const html = render('<script>alert(1)</script> と書いた');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('件名もエスケープする（title 要素から抜けさせない）', () => {
    const html = render('本文', '</title><script>x</script>');
    expect(html).not.toContain('</title><script>');
    expect(html).toContain('&lt;/title&gt;');
  });

  it('[文字](URL) を a 要素にする', () => {
    const html = render('詳しくは [こちら](https://oryzae.ephemere.io/support) を見てください');
    expect(html).toContain('<a href="https://oryzae.ephemere.io/support"');
    expect(html).toContain('>こちら</a>');
  });

  it('http/https 以外のリンクは a 要素にしない（javascript: を作らせない）', () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', '/relative/path']) {
      const html = render(`[押す](${url})`);
      expect(html).not.toContain(`href="${url}"`);
      // リンクにならなかった場合は素のテキストとして残る
      expect(html).toContain('[押す]');
    }
  });

  it('**太字** を strong にする', () => {
    expect(render('これは **重要** です')).toContain('<strong>重要</strong>');
  });

  it('見出し・箇条書き・区切り線を対応する要素にする', () => {
    const html = render('## 新機能\n\n- ひとつ\n- ふたつ\n\n---\n\n本文');
    expect(html).toContain('<h2');
    expect(html).toContain('>新機能</h2>');
    expect(html).toContain('<ul');
    expect(html).toContain('>ひとつ</li>');
    expect(html).toContain('<hr');
    expect(html).toContain('<p');
  });

  it('段落内の改行は <br /> にする（書いたとおりに改行させる）', () => {
    expect(render('一行目\n二行目')).toContain('一行目<br />二行目');
  });

  it('フッターに配信停止の連絡先を必ず入れる', () => {
    const html = render('本文');
    expect(html).toContain('oryzae@ephemere.io');
    expect(html).toContain('配信停止');
    expect(html).toContain('https://oryzae.ephemere.io/privacy');
  });

  it('CSS は inline のみ（Gmail が style 要素を落とすため）', () => {
    expect(render('本文')).not.toContain('<style');
  });
});

describe('renderNewsletterText', () => {
  it('リンクは「文字 (URL)」に開く（テキストでは href が読めないため）', () => {
    const text = renderNewsletterText({
      subject: '件名',
      bodyMarkdown: '詳しくは [こちら](https://oryzae.ephemere.io/support) へ',
    });
    expect(text).toContain('こちら (https://oryzae.ephemere.io/support)');
  });

  it('太字の記号を落とし、箇条書きを ・ にする', () => {
    const text = renderNewsletterText({
      subject: '件名',
      bodyMarkdown: '**重要**\n\n- ひとつ\n- ふたつ',
    });
    expect(text).toContain('重要');
    expect(text).not.toContain('**');
    expect(text).toContain('・ひとつ');
    expect(text).toContain('・ふたつ');
  });

  it('件名で始まり、フッターで終わる', () => {
    const text = renderNewsletterText({ subject: '今月の更新', bodyMarkdown: '本文' });
    expect(text.startsWith('今月の更新')).toBe(true);
    expect(text.trimEnd().endsWith('— Oryzae / Ferment Media Research')).toBe(true);
  });

  it('HTML はエスケープしない（テキストでは実体参照が読めないため）', () => {
    const text = renderNewsletterText({ subject: '件名', bodyMarkdown: '5 < 10 です' });
    expect(text).toContain('5 < 10 です');
    expect(text).not.toContain('&lt;');
  });
});

describe('buildPreheader', () => {
  it('最初の段落から作る', () => {
    expect(buildPreheader('こんにちは。今月の更新です。\n\n## 新機能')).toBe(
      'こんにちは。今月の更新です。',
    );
  });

  it('見出しから始まる本文では見出しを使う', () => {
    expect(buildPreheader('## 新機能\n\n本文')).toBe('新機能');
  });

  it('記法を落としてから長さで切り詰める', () => {
    const long = `**強調** ${'あ'.repeat(200)}`;
    const preheader = buildPreheader(long, 20);
    expect(preheader).not.toContain('**');
    expect(preheader.length).toBe(20);
    expect(preheader.endsWith('…')).toBe(true);
  });

  it('本文が空なら空文字（受信箱に意味のない文字列を出さない）', () => {
    expect(buildPreheader('')).toBe('');
  });
});
