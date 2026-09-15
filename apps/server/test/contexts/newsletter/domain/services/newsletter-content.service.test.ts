import { describe, expect, it } from 'vitest';
import {
  buildPreheader,
  buildUnsubscribeUrl,
  escapeHtml,
  parseNewsletterBody,
  renderNewsletterHtml,
  renderNewsletterText,
} from '@/contexts/newsletter/domain/services/newsletter-content.service.js';

const UNSUBSCRIBE_URL = buildUnsubscribeUrl('tok-123');

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
    renderNewsletterHtml({ subject, bodyMarkdown, unsubscribeUrl: UNSUBSCRIBE_URL, locale: 'ja' });

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

  it('許可していないスキームのリンクは a 要素にしない（javascript: を作らせない）', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,x',
      'vbscript:msgbox(1)',
      'file:///etc/passwd',
      '/relative/path',
    ]) {
      const html = render(`[押す](${url})`);
      expect(html).not.toContain(`href="${url}"`);
      // リンクにならなかった場合は素のテキストとして残る
      expect(html).toContain('[押す]');
    }
  });

  // お知らせメールのフッターに問い合わせ先を置くのはごく普通の書き方。
  // ここを塞いでいたせいで、記法のまま届いた。
  it('mailto: をリンクにする', () => {
    const html = render('ご不明な点は [お問い合わせ](mailto:oryzae@ephemere.io) まで');

    expect(html).toContain('<a href="mailto:oryzae@ephemere.io"');
    expect(html).toContain('>お問い合わせ</a>');
    expect(html).not.toContain('[お問い合わせ]');
  });

  it('mailto: の件名つきもそのまま href に載せる', () => {
    const html = render('[質問する](mailto:oryzae@ephemere.io?subject=Oryzae)');

    expect(html).toContain('href="mailto:oryzae@ephemere.io?subject=Oryzae"');
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

  it('フッターに配信停止リンクと問い合わせ先を必ず入れる', () => {
    const html = render('本文');
    expect(html).toContain(`href="${UNSUBSCRIBE_URL}"`);
    expect(html).toContain('このお知らせの配信を停止する');
    expect(html).toContain('oryzae@ephemere.io');
    expect(html).toContain('https://oryzae.ephemere.io/privacy');
  });

  // 止める口が本文のどこかに紛れていると、探すより迷惑メール報告のほうが早くなる。
  it('配信停止はリンクとして独立させる（他のフッター行に混ぜない）', () => {
    const html = render('本文');
    expect(html).toContain('<a href="https://oryzae.ephemere.io/unsubscribe?token=tok-123"');
    expect(html).toContain('アカウントと日記はそのまま残ります');
  });

  it('配信停止 URL もエスケープする（属性から抜けさせない）', () => {
    const html = renderNewsletterHtml({
      subject: '件名',
      bodyMarkdown: '本文',
      unsubscribeUrl: 'https://oryzae.ephemere.io/unsubscribe?token=a"onmouseover="x',
      locale: 'ja',
    });
    expect(html).not.toContain('onmouseover="x"');
    expect(html).toContain('&quot;onmouseover=&quot;x');
  });

  it('フッターの頭に、トップページへのリンクにしたロゴを中央で出す', () => {
    const html = render('本文');

    expect(html).toContain('<a href="https://oryzae.ephemere.io"');
    expect(html).toContain('src="https://oryzae.ephemere.io/icon-192"');
    expect(html).toContain('text-align:center');
  });

  // ロゴだけだと押せることが伝わらない。メールの中の画像は装飾と思われる。
  it('ロゴに「押せる」と分かる文言を添え、下線付きのリンクにする', () => {
    const html = render('本文');

    expect(html).toContain('Oryzae を開く');
    expect(html).toContain('text-decoration:underline');
  });

  it('文言もロゴと同じトップページへ飛ばす', () => {
    const html = render('本文');
    const label = html.indexOf('Oryzae を開く');

    // 文言の直前の a の href がトップページであること。
    const anchor = html.lastIndexOf('<a href=', label);
    expect(html.slice(anchor, anchor + 40)).toContain('href="https://oryzae.ephemere.io"');
  });

  // 画像は既定でブロックされることが多い。そのとき alt だけが手がかりになる。
  it('ロゴに alt を入れる', () => {
    expect(render('本文')).toContain('alt="Oryzae"');
  });

  // Outlook は CSS の寸法を無視し、リンクした画像に枠線を描く。
  it('ロゴの寸法を属性でも指定し、枠線を消す', () => {
    const html = render('本文');

    expect(html).toContain('width="40"');
    expect(html).toContain('height="40"');
    expect(html).toContain('border:0');
  });

  // Gmail は SVG もデータ URI も表示しない。
  it('ロゴは公開 URL の PNG（SVG / データ URI を使わない）', () => {
    const html = render('本文');

    expect(html).not.toContain('icon.svg');
    expect(html).not.toContain('data:image');
  });

  it('ロゴの文言は本文の言語に合わせる', () => {
    const cases: Array<[Parameters<typeof renderNewsletterHtml>[0]['locale'], string]> = [
      ['ja', 'Oryzae を開く'],
      ['en', 'Open Oryzae'],
      ['zh', '打开 Oryzae'],
      ['ko', 'Oryzae 열기'],
    ];

    for (const [locale, label] of cases) {
      const html = renderNewsletterHtml({
        subject: '件名',
        bodyMarkdown: '本文',
        unsubscribeUrl: UNSUBSCRIBE_URL,
        locale,
      });
      expect(html).toContain(label);
    }
  });

  it('ロゴは配信停止リンクより前に出す（フッターの頭）', () => {
    const html = render('本文');

    expect(html.indexOf('alt="Oryzae"')).toBeLessThan(html.indexOf('このお知らせの配信を停止する'));
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
      unsubscribeUrl: UNSUBSCRIBE_URL,
      locale: 'ja',
    });
    expect(text).toContain('こちら (https://oryzae.ephemere.io/support)');
  });

  // 「お問い合わせ (mailto:oryzae@ephemere.io)」は読み手には邪魔なだけ。
  it('mailto: はスキームを落として住所だけ出す', () => {
    const text = renderNewsletterText({
      subject: '件名',
      bodyMarkdown: 'ご不明な点は [お問い合わせ](mailto:oryzae@ephemere.io) まで',
      unsubscribeUrl: UNSUBSCRIBE_URL,
      locale: 'ja',
    });

    expect(text).toContain('お問い合わせ (oryzae@ephemere.io)');
    expect(text).not.toContain('(mailto:');
  });

  it('太字の記号を落とし、箇条書きを ・ にする', () => {
    const text = renderNewsletterText({
      subject: '件名',
      bodyMarkdown: '**重要**\n\n- ひとつ\n- ふたつ',
      unsubscribeUrl: UNSUBSCRIBE_URL,
      locale: 'ja',
    });
    expect(text).toContain('重要');
    expect(text).not.toContain('**');
    expect(text).toContain('・ひとつ');
    expect(text).toContain('・ふたつ');
  });

  it('テキスト版も 受信理由 → 配信停止 の順に並ぶ', () => {
    const text = renderNewsletterText({
      subject: '件名',
      bodyMarkdown: '本文',
      unsubscribeUrl: UNSUBSCRIBE_URL,
      locale: 'ja',
    });

    expect(text.indexOf('登録されている方へお送りしています')).toBeLessThan(
      text.indexOf('このお知らせの配信を停止する'),
    );
    expect(text.indexOf('このお知らせの配信を停止する')).toBeLessThan(text.indexOf('ヘルプ・FAQ'));
  });

  it('件名で始まり、フッターで終わる', () => {
    const text = renderNewsletterText({
      subject: '今月の更新',
      bodyMarkdown: '本文',
      unsubscribeUrl: UNSUBSCRIBE_URL,
      locale: 'ja',
    });
    expect(text.startsWith('今月の更新')).toBe(true);
    expect(text.trimEnd().endsWith('— Oryzae / Ferment Media Research')).toBe(true);
  });

  it('テキスト版にも配信停止 URL を素のまま載せる', () => {
    const text = renderNewsletterText({
      subject: '件名',
      bodyMarkdown: '本文',
      unsubscribeUrl: UNSUBSCRIBE_URL,
      locale: 'ja',
    });
    expect(text).toContain(UNSUBSCRIBE_URL);
  });

  it('HTML はエスケープしない（テキストでは実体参照が読めないため）', () => {
    const text = renderNewsletterText({
      subject: '件名',
      bodyMarkdown: '5 < 10 です',
      unsubscribeUrl: UNSUBSCRIBE_URL,
      locale: 'ja',
    });
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
