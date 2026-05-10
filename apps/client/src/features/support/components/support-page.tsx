'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import type { Locale } from '@/i18n/config';
import { setLocaleAction } from '@/lib/i18n-actions';
import { makeT, type SupportContent } from '../lib/content-types';
import styles from './support.module.css';
import { SupportFaqItem } from './support-faq-item';

const APP_HREF = '/login';
const LANDING_HREF = '/';
const LOGO_SRC = '/landing/logo/P3_mark_color.svg';

const TOC_ANCHORS = [
  '#intro',
  '#basics',
  '#editor',
  '#effects',
  '#account',
  '#faq',
  '#contact',
] as const;

type T = (key: string) => string;

const BASIC_STEPS = ['step_1', 'step_2', 'step_3', 'step_4', 'step_5', 'step_6'] as const;

const EDITOR_FEATURES = [
  'feature_layout',
  'feature_font',
  'feature_autosave',
  'feature_snippet',
  'feature_link_question',
  'feature_stats',
  'feature_voice',
  'feature_fullscreen',
] as const;

const EFFECT_ROWS = [
  'row_focus',
  'row_time',
  'row_eraser',
  'row_amp',
  'row_voice',
  'row_ghost',
] as const;

const ACCOUNT_ITEMS = [
  'item_nickname',
  'item_email',
  'item_password',
  'item_theme',
  'item_language',
  'item_stats',
] as const;

const FAQ_INDICES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const PLACES = ['place_editor', 'place_jar', 'place_board', 'place_letter'] as const;

interface SupportPageProps {
  content: SupportContent;
}

export function SupportPage({ content }: SupportPageProps) {
  const t = makeT(content);
  const locale = useLocale();

  return (
    <div className={styles.supportRoot}>
      <SiteHeader lang={locale as Locale} t={t} />
      <main id="top">
        <Hero t={t} />
        <Toc t={t} />
        <Intro t={t} />
        <Basics t={t} />
        <Editor t={t} />
        <Effects t={t} />
        <Account t={t} />
        <Faq t={t} />
        <Contact t={t} />
        <Outro t={t} />
      </main>
      <SiteFooter t={t} />
    </div>
  );
}

interface HeaderProps {
  lang: Locale;
  t: T;
}

function SiteHeader({ lang, t }: HeaderProps) {
  const [isPending, startTransition] = useTransition();
  const setLang = (next: Locale) => {
    if (next === lang) return;
    startTransition(() => {
      setLocaleAction(next);
    });
  };

  return (
    <header className={styles.siteHeader}>
      <Link className={styles.brand} href={LANDING_HREF} aria-label="Oryzae">
        {/* biome-ignore lint/performance/noImgElement: small inline SVG, next/image overkill */}
        <img src={LOGO_SRC} alt="" className={styles.brandMark} />
        <span className={styles.brandName}>Oryzae</span>
      </Link>
      <div className={styles.headerActions}>
        {/* biome-ignore lint/a11y/useSemanticElements: pill-style toggle, fieldset would force legend/border styling */}
        <div className={styles.langToggle} role="group" aria-label="Language">
          <button
            type="button"
            className={styles.langBtn}
            aria-pressed={lang === 'ja'}
            onClick={() => setLang('ja')}
            disabled={isPending}
          >
            日本語
          </button>
          <button
            type="button"
            className={styles.langBtn}
            aria-pressed={lang === 'en'}
            onClick={() => setLang('en')}
            disabled={isPending}
          >
            English
          </button>
        </div>
        <Link className={styles.cta} href={APP_HREF}>
          {t('nav.cta')}
        </Link>
      </div>
    </header>
  );
}

function Hero({ t }: { t: T }) {
  return (
    <section className={styles.hero} aria-labelledby="support-hero-title">
      <div className={styles.heroInner}>
        <p className={styles.eyebrow}>{t('hero.eyebrow')}</p>
        <h1 id="support-hero-title" className={styles.heroTitle}>
          {t('hero.title')}
        </h1>
        <p className={styles.heroLead}>{t('hero.lead')}</p>
      </div>
    </section>
  );
}

function Toc({ t }: { t: T }) {
  return (
    <nav className={styles.toc} aria-label={t('toc.label')}>
      <div className={styles.tocInner}>
        <p className={styles.tocLabel}>{t('toc.label')}</p>
        <ol className={styles.tocList}>
          {TOC_ANCHORS.map((anchor, i) => {
            const n = i + 1;
            return (
              <li key={anchor}>
                <a href={anchor}>
                  {n}. {t(`toc.${n}`)}
                </a>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

function Intro({ t }: { t: T }) {
  return (
    <section id="intro" className={styles.section} aria-labelledby="support-intro-title">
      <div className={styles.sectionInnerWide}>
        <p className={styles.eyebrow}>{t('intro.kicker')}</p>
        <h2 id="support-intro-title" className={styles.sectionTitle}>
          {t('intro.title')}
        </h2>
        <p className={styles.sectionLead}>{t('intro.lead')}</p>
        <ul className={styles.placeGrid}>
          {PLACES.map((key) => (
            <li key={key} className={styles.placeCard}>
              <h3 className={styles.placeName}>{t(`intro.${key}.name`)}</h3>
              <p className={styles.placeBody}>{t(`intro.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Basics({ t }: { t: T }) {
  return (
    <section id="basics" className={styles.section} aria-labelledby="support-basics-title">
      <div className={styles.sectionInner}>
        <p className={styles.eyebrow}>{t('basics.kicker')}</p>
        <h2 id="support-basics-title" className={styles.sectionTitle}>
          {t('basics.title')}
        </h2>
        <p className={styles.sectionLead}>{t('basics.lead')}</p>
        <ol className={styles.itemList}>
          {BASIC_STEPS.map((key) => (
            <li key={key}>
              <h3 className={styles.itemTitle}>{t(`basics.${key}.title`)}</h3>
              <p className={styles.itemBody}>{t(`basics.${key}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Editor({ t }: { t: T }) {
  return (
    <section id="editor" className={styles.section} aria-labelledby="support-editor-title">
      <div className={styles.sectionInner}>
        <p className={styles.eyebrow}>{t('editor.kicker')}</p>
        <h2 id="support-editor-title" className={styles.sectionTitle}>
          {t('editor.title')}
        </h2>
        <p className={styles.sectionLead}>{t('editor.lead')}</p>
        <ul className={styles.itemList}>
          {EDITOR_FEATURES.map((key) => (
            <li key={key}>
              <h3 className={styles.itemTitle}>{t(`editor.${key}.title`)}</h3>
              <p className={styles.itemBody}>{t(`editor.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Effects({ t }: { t: T }) {
  return (
    <section id="effects" className={styles.section} aria-labelledby="support-effects-title">
      <div className={styles.sectionInnerWide}>
        <p className={styles.eyebrow}>{t('effects.kicker')}</p>
        <h2 id="support-effects-title" className={styles.sectionTitle}>
          {t('effects.title')}
        </h2>
        <p className={styles.sectionLead}>{t('effects.lead')}</p>
        <div className={styles.effectsTableWrap}>
          <table className={styles.effectsTable}>
            <thead>
              <tr>
                <th scope="col">{t('effects.table.header_name')}</th>
                <th scope="col">{t('effects.table.header_what')}</th>
                <th scope="col">{t('effects.table.header_when')}</th>
              </tr>
            </thead>
            <tbody>
              {EFFECT_ROWS.map((key) => (
                <tr key={key}>
                  <td>{t(`effects.${key}.name`)}</td>
                  <td>{t(`effects.${key}.what`)}</td>
                  <td>{t(`effects.${key}.when`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.effectsOutro}>{t('effects.outro')}</p>
      </div>
    </section>
  );
}

function Account({ t }: { t: T }) {
  return (
    <section id="account" className={styles.section} aria-labelledby="support-account-title">
      <div className={styles.sectionInner}>
        <p className={styles.eyebrow}>{t('account.kicker')}</p>
        <h2 id="support-account-title" className={styles.sectionTitle}>
          {t('account.title')}
        </h2>
        <p className={styles.sectionLead}>{t('account.lead')}</p>
        <ul className={styles.itemList}>
          {ACCOUNT_ITEMS.map((key) => (
            <li key={key}>
              <h3 className={styles.itemTitle}>{t(`account.${key}.title`)}</h3>
              <p className={styles.itemBody}>{t(`account.${key}.body`)}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Faq({ t }: { t: T }) {
  return (
    <section id="faq" className={styles.section} aria-labelledby="support-faq-title">
      <div className={styles.sectionInner}>
        <p className={styles.eyebrow}>{t('faq.kicker')}</p>
        <h2 id="support-faq-title" className={styles.sectionTitle}>
          {t('faq.title')}
        </h2>
        <ul className={styles.faqList}>
          {FAQ_INDICES.map((n) => (
            <SupportFaqItem key={n} question={t(`faq.${n}.q`)} answer={t(`faq.${n}.a`)} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function Contact({ t }: { t: T }) {
  const email = t('contact.email');
  return (
    <section id="contact" className={styles.section} aria-labelledby="support-contact-title">
      <div className={styles.sectionInner}>
        <p className={styles.eyebrow}>{t('contact.kicker')}</p>
        <h2 id="support-contact-title" className={styles.sectionTitle}>
          {t('contact.title')}
        </h2>
        <p className={styles.sectionLead}>{t('contact.lead')}</p>
        <div className={styles.contactCard}>
          <div className={styles.contactRow}>
            <span className={styles.contactLabel}>{t('contact.email_label')}</span>
            <span className={styles.contactValue}>
              <a href={`mailto:${email}`}>{email}</a>
            </span>
          </div>
          <p className={styles.contactNote}>{t('contact.note')}</p>
        </div>
      </div>
    </section>
  );
}

function Outro({ t }: { t: T }) {
  return (
    <section className={styles.outro} aria-label={t('outro.lead')}>
      <p className={styles.outroLead}>{t('outro.lead')}</p>
      <div className={styles.outroActions}>
        <Link href={APP_HREF} className={`${styles.outroBtn} ${styles.outroBtnPrimary}`}>
          {t('outro.cta_app')}
        </Link>
        <Link href={LANDING_HREF} className={`${styles.outroBtn} ${styles.outroBtnGhost}`}>
          {t('outro.cta_landing')}
        </Link>
      </div>
    </section>
  );
}

function SiteFooter({ t }: { t: T }) {
  return (
    <footer className={styles.siteFooter}>
      <div className={styles.footGrid}>
        <div>
          {/* biome-ignore lint/performance/noImgElement: small inline SVG, next/image overkill */}
          <img src={LOGO_SRC} alt="" className={styles.footMark} />
          <p className={styles.footName}>Oryzae</p>
          <p className={styles.footTag}>Aspergillus oryzae for words.</p>
        </div>
        <div className={styles.footMeta}>
          <p>© 2026 Ephemere</p>
          <p>
            <a href="https://ephemere.io" target="_blank" rel="noopener noreferrer">
              ephemere.io
            </a>
          </p>
          <p>
            <Link href={LANDING_HREF}>{t('nav.back_to_landing')}</Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
