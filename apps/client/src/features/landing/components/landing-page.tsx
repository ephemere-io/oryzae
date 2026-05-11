'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useTransition } from 'react';
import type { Locale } from '@/i18n/config';
import { setLocaleAction } from '@/lib/i18n-actions';
import { useSignupAvailability } from '@/lib/use-signup-availability';
import styles from './landing.module.css';
import { LandingFaqItem } from './landing-faq-item';

const APP_HREF = '/login';
const LOGO_SRC = '/landing/logo/P3_mark_color.svg';

export function LandingPage() {
  const t = useTranslations('landing');
  const locale = useLocale();

  useEffect(() => {
    document.title = t('title');
  }, [t]);

  return (
    <div className={styles.landingRoot}>
      <SiteHeader lang={locale as Locale} t={t} />
      <main id="top">
        <Hero t={t} />
        <Concept t={t} />
        <Process t={t} />
        <Preview t={t} />
        <Philosophy t={t} />
        <Faq t={t} />
        <Outro t={t} />
      </main>
      <SiteFooter t={t} />
    </div>
  );
}

type T = (key: string) => string;

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
      <a className={styles.brand} href="#top" aria-label="Oryzae">
        {/* biome-ignore lint/performance/noImgElement: small inline SVG, next/image overkill */}
        <img src={LOGO_SRC} alt="" className={styles.brandMark} />
        <span className={styles.brandName}>Oryzae</span>
      </a>
      <nav className={styles.siteNav} aria-label="primary">
        <a href="#concept">{t('nav.concept')}</a>
        <a href="#process">{t('nav.process')}</a>
        <a href="#preview">{t('nav.preview')}</a>
        <a href="#philosophy">{t('nav.philosophy')}</a>
        <a href="#faq">{t('nav.faq')}</a>
      </nav>
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
        <Link className={`${styles.cta} ${styles.ctaSmall}`} href={APP_HREF}>
          {t('nav.cta')}
        </Link>
      </div>
    </header>
  );
}

function Hero({ t }: { t: T }) {
  // Issue #300: Research Preview の登録枠表示。サーバーが落ちている等で取得失敗時はバッジ非表示。
  const tHero = useTranslations('landing.hero');
  const { availability } = useSignupAvailability();
  const capacityFull = availability?.capacityReached === true;

  return (
    <section className={styles.hero}>
      <div className={styles.heroGrid}>
        <div>
          <p className={styles.eyebrow}>{t('hero.eyebrow')}</p>
          <h1 className={styles.heroTitle}>
            <span>{t('hero.title.l1')}</span>
            <span>{t('hero.title.l2')}</span>
          </h1>
          <p className={styles.heroLead}>{t('hero.lead')}</p>
          {availability && (
            <p
              className={`${styles.heroCapacityBadge} ${capacityFull ? styles.heroCapacityBadgeFull : ''}`}
            >
              {capacityFull
                ? tHero('capacity_full_badge')
                : tHero('capacity_badge', {
                    remaining: availability.remaining,
                    max: availability.limit,
                  })}
            </p>
          )}
          <div className={styles.heroActions}>
            {capacityFull ? (
              <button type="button" className={`${styles.cta} ${styles.ctaDisabled}`} disabled>
                {tHero('cta.full')}
              </button>
            ) : (
              <Link className={styles.cta} href={APP_HREF}>
                {t('hero.cta.primary')}
              </Link>
            )}
            <a className={`${styles.cta} ${styles.ctaGhost}`} href="#concept">
              {t('hero.cta.secondary')}
            </a>
          </div>
        </div>

        <div className={styles.heroVisual} aria-hidden="true">
          <svg
            viewBox="0 0 520 600"
            className={styles.jarSvg}
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="lpLiquid" cx="50%" cy="60%" r="55%">
                <stop offset="0%" stopColor="#F9EFD8" />
                <stop offset="60%" stopColor="#F2EDE0" />
                <stop offset="100%" stopColor="#E8E1CB" />
              </radialGradient>
              <radialGradient id="lpGlow" cx="50%" cy="55%" r="60%">
                <stop offset="0%" stopColor="#FFF6DC" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#FFF6DC" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="260" cy="340" r="240" fill="url(#lpGlow)" />
            <g>
              <path
                d="M 220 110 L 220 218 C 220 244, 124 270, 100 360 C 80 444, 160 510, 260 510 C 360 510, 440 444, 420 360 C 396 270, 300 244, 300 218 L 300 110 Z"
                fill="url(#lpLiquid)"
                stroke="#7A7440"
                strokeWidth="1.6"
                strokeOpacity="0.55"
              />
              <ellipse
                cx="260"
                cy="110"
                rx="40"
                ry="9"
                fill="none"
                stroke="#7A7440"
                strokeWidth="1.6"
                strokeOpacity="0.55"
              />
            </g>
            <g>
              <circle cx="260" cy="298" r="13" fill="#9C9658" opacity="0.55" />
              <circle cx="260" cy="338" r="10" fill="#9C9658" opacity="0.45" />
              <circle cx="260" cy="375" r="7" fill="#9C9658" opacity="0.35" />
              <circle cx="220" cy="320" r="9" fill="#9C9658" opacity="0.45" />
              <circle cx="220" cy="356" r="7" fill="#9C9658" opacity="0.35" />
              <circle cx="300" cy="320" r="9" fill="#9C9658" opacity="0.45" />
              <circle cx="300" cy="356" r="7" fill="#9C9658" opacity="0.35" />
            </g>
            <g>
              <line
                x1="260"
                y1="300"
                x2="80"
                y2="160"
                stroke="#7A7440"
                strokeOpacity="0.18"
                strokeDasharray="2 4"
              />
              <line
                x1="260"
                y1="300"
                x2="450"
                y2="160"
                stroke="#7A7440"
                strokeOpacity="0.18"
                strokeDasharray="2 4"
              />
              <line
                x1="260"
                y1="300"
                x2="60"
                y2="430"
                stroke="#7A7440"
                strokeOpacity="0.18"
                strokeDasharray="2 4"
              />
              <line
                x1="260"
                y1="300"
                x2="475"
                y2="430"
                stroke="#7A7440"
                strokeOpacity="0.18"
                strokeDasharray="2 4"
              />
            </g>
          </svg>

          <div className={styles.chips}>
            <div className={`${styles.chip} ${styles.chip1}`}>{t('hero.chip.1')}</div>
            <div className={`${styles.chip} ${styles.chip2}`}>{t('hero.chip.2')}</div>
            <div className={`${styles.chip} ${styles.chip3}`}>{t('hero.chip.3')}</div>
            <div className={`${styles.chip} ${styles.chip4}`}>{t('hero.chip.4')}</div>
            <div className={styles.snippet}>
              <span className={styles.snippetIcon} aria-hidden="true">
                ✉
              </span>
              <span>{t('hero.snippet.1')}</span>
            </div>
            <div className={styles.questionLabel}>{t('hero.question')}</div>
          </div>
        </div>
      </div>

      <p className={styles.heroFoot}>{t('hero.foot')}</p>
    </section>
  );
}

function Concept({ t }: { t: T }) {
  return (
    <section id="concept" className={`${styles.section} ${styles.sectionConcept}`}>
      <div className={styles.sectionHead}>
        <p className={styles.kicker}>{t('concept.kicker')}</p>
        <h2 className={styles.sectionTitle}>{t('concept.title')}</h2>
      </div>
      <div className={styles.conceptGrid}>
        <p className={styles.conceptLead}>{t('concept.lead')}</p>
        <ul className={styles.conceptPillars}>
          <li>
            <span className={styles.pillarNum}>01</span>
            <h3>{t('concept.p1.title')}</h3>
            <p>{t('concept.p1.body')}</p>
          </li>
          <li>
            <span className={styles.pillarNum}>02</span>
            <h3>{t('concept.p2.title')}</h3>
            <p>{t('concept.p2.body')}</p>
          </li>
          <li>
            <span className={styles.pillarNum}>03</span>
            <h3>{t('concept.p3.title')}</h3>
            <p>{t('concept.p3.body')}</p>
          </li>
        </ul>
      </div>
    </section>
  );
}

function Process({ t }: { t: T }) {
  return (
    <section id="process" className={`${styles.section} ${styles.sectionProcess}`}>
      <div className={styles.sectionHead}>
        <p className={styles.kicker}>{t('process.kicker')}</p>
        <h2 className={styles.sectionTitle}>
          <span>{t('process.title.l1')}</span>
          <span className={styles.sectionTitleSub}>{t('process.title.l2')}</span>
        </h2>
        <p className={styles.sectionLead}>{t('process.lead')}</p>
      </div>

      <div className={styles.microbes}>
        <article className={styles.microbe}>
          <div className={styles.microbeMark} aria-hidden="true">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle
                cx="50"
                cy="50"
                r="34"
                fill="none"
                stroke="#7A7440"
                strokeWidth="1.5"
                strokeOpacity="0.6"
              />
              <g fill="#9C9658">
                <circle cx="50" cy="38" r="6" />
                <circle cx="50" cy="56" r="5" />
                <circle cx="38" cy="48" r="4.5" />
                <circle cx="62" cy="48" r="4.5" />
                <circle cx="42" cy="62" r="3.5" />
                <circle cx="58" cy="62" r="3.5" />
              </g>
            </svg>
          </div>
          <p className={styles.microbeStep}>01</p>
          <h3 className={styles.microbeName}>
            <span className={styles.nameJa}>コウジカビ</span>
            <span className={styles.nameEn}>Koji</span>
          </h3>
          <p className={styles.microbeRole}>{t('process.koji.role')}</p>
          <p className={styles.microbeBody}>{t('process.koji.body')}</p>
          <p className={styles.microbeOutput}>{t('process.koji.output')}</p>
        </article>

        <article className={styles.microbe}>
          <div className={styles.microbeMark} aria-hidden="true">
            {/* Lactobacillus — rod-shaped bacterium cluster */}
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <g transform="rotate(18 30 38)">
                <rect
                  x="14"
                  y="34"
                  width="34"
                  height="8.5"
                  rx="4.25"
                  fill="#F4EFDD"
                  stroke="#7A7440"
                  strokeWidth="1.5"
                  strokeOpacity="0.6"
                />
                <ellipse cx="31" cy="38.25" rx="11" ry="1.6" fill="#9C9658" opacity="0.55" />
              </g>
              <g transform="rotate(-14 66 47)">
                <rect
                  x="48"
                  y="43"
                  width="36"
                  height="8.5"
                  rx="4.25"
                  fill="#F4EFDD"
                  stroke="#7A7440"
                  strokeWidth="1.5"
                  strokeOpacity="0.6"
                />
                <ellipse cx="66" cy="47.25" rx="12.5" ry="1.6" fill="#9C9658" opacity="0.55" />
              </g>
              <g transform="rotate(-28 35 65)">
                <rect
                  x="20"
                  y="61"
                  width="30"
                  height="8"
                  rx="4"
                  fill="#F4EFDD"
                  stroke="#7A7440"
                  strokeWidth="1.5"
                  strokeOpacity="0.6"
                />
                <ellipse cx="35" cy="65" rx="10" ry="1.5" fill="#9C9658" opacity="0.55" />
              </g>
              <g transform="rotate(8 65 71)">
                <rect
                  x="51"
                  y="67"
                  width="28"
                  height="7.5"
                  rx="3.75"
                  fill="#F4EFDD"
                  stroke="#7A7440"
                  strokeWidth="1.5"
                  strokeOpacity="0.6"
                />
                <ellipse cx="65" cy="70.75" rx="9" ry="1.4" fill="#9C9658" opacity="0.55" />
              </g>
            </svg>
          </div>
          <p className={styles.microbeStep}>02</p>
          <h3 className={styles.microbeName}>
            <span className={styles.nameJa}>乳酸菌</span>
            <span className={styles.nameEn}>Lactic</span>
          </h3>
          <p className={styles.microbeRole}>{t('process.lactic.role')}</p>
          <p className={styles.microbeBody}>{t('process.lactic.body')}</p>
          <p className={styles.microbeOutput}>{t('process.lactic.output')}</p>
        </article>

        <article className={styles.microbe}>
          <div className={styles.microbeMark} aria-hidden="true">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <g fill="none" stroke="#7A7440" strokeWidth="1.5" strokeOpacity="0.6">
                <circle cx="34" cy="44" r="9" />
                <circle cx="60" cy="36" r="7" />
                <circle cx="58" cy="62" r="11" />
                <circle cx="38" cy="68" r="6" />
              </g>
              <g fill="#E8B838" opacity="0.55">
                <circle cx="34" cy="44" r="3" />
                <circle cx="60" cy="36" r="2.5" />
                <circle cx="58" cy="62" r="3.5" />
                <circle cx="38" cy="68" r="2" />
              </g>
            </svg>
          </div>
          <p className={styles.microbeStep}>03</p>
          <h3 className={styles.microbeName}>
            <span className={styles.nameJa}>酵母</span>
            <span className={styles.nameEn}>Yeast</span>
          </h3>
          <p className={styles.microbeRole}>{t('process.yeast.role')}</p>
          <p className={styles.microbeBody}>{t('process.yeast.body')}</p>
          <p className={styles.microbeOutput}>{t('process.yeast.output')}</p>
        </article>
      </div>
    </section>
  );
}

function Preview({ t }: { t: T }) {
  return (
    <section id="preview" className={styles.section}>
      <div className={styles.sectionHead}>
        <p className={styles.kicker}>{t('preview.kicker')}</p>
        <h2 className={styles.sectionTitle}>{t('preview.title')}</h2>
        <p className={styles.sectionLead}>{t('preview.lead')}</p>
      </div>

      <div className={styles.previews}>
        <figure className={`${styles.previewCard} ${styles.previewEditor}`}>
          <div className={styles.windowEl}>
            <div className={styles.windowRail}>
              <div className={styles.railBrand}>ORYZAE</div>
              <div className={styles.railIcons}>
                <div className={styles.railIcon} />
                <div className={styles.railIcon} />
                <div className={styles.railIcon} />
                <div className={`${styles.railIcon} ${styles.railIconActive}`} />
              </div>
              <div className={styles.railAvatar}>D</div>
            </div>
            <div className={styles.windowBody}>
              <div className={styles.windowToolbar}>
                <span className={styles.toolDate}>2026.5.3 — 日曜日 · 17:33</span>
                <span className={styles.toolTitle}>{t('preview.editor.title')}</span>
              </div>
              <div className={styles.verticalPane}>
                <p className={styles.verticalText}>{t('preview.editor.prompt')}</p>
                <span className={`${styles.ghostChar} ${styles.ghostChar1}`} aria-hidden="true">
                  は
                </span>
                <span className={`${styles.ghostChar} ${styles.ghostChar2}`} aria-hidden="true">
                  じ
                </span>
                <span className={`${styles.ghostChar} ${styles.ghostChar3}`} aria-hidden="true">
                  め
                </span>
              </div>
              <div className={styles.windowFoot}>
                <span className={styles.footStatus}>{t('preview.editor.status')}</span>
                <span className={styles.footEffect}>
                  <span className={styles.effectDot} aria-hidden="true" />
                  <span>{t('preview.editor.effect')}</span>
                </span>
                <span className={styles.footCount}>0 CHARS</span>
              </div>
            </div>
          </div>
          <figcaption>{t('preview.editor.caption')}</figcaption>
        </figure>

        <figure className={`${styles.previewCard} ${styles.previewBoard}`}>
          <div className={styles.windowEl}>
            <div className={`${styles.windowRail} ${styles.railMini}`}>
              <div className={styles.railIcons}>
                <div className={styles.railIcon} />
                <div className={`${styles.railIcon} ${styles.railIconActive}`} />
                <div className={styles.railIcon} />
                <div className={styles.railIcon} />
              </div>
            </div>
            <div className={`${styles.windowBody} ${styles.windowBodyBoard}`}>
              <div className={styles.boardToolbar}>
                <span className={styles.boardDate}>2026.5.3 — 日曜日</span>
                <div className={styles.boardToggle}>
                  <span className={`${styles.btPill} ${styles.btPillActive}`}>
                    {t('preview.board.toggle.daily')}
                  </span>
                  <span className={styles.btPill}>{t('preview.board.toggle.weekly')}</span>
                </div>
              </div>
              <div className={styles.boardCanvas} aria-hidden="true">
                <svg
                  className={styles.boardGrid}
                  viewBox="0 0 400 280"
                  xmlns="http://www.w3.org/2000/svg"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <defs>
                    <pattern
                      id="lpDotgrid"
                      x="0"
                      y="0"
                      width="14"
                      height="14"
                      patternUnits="userSpaceOnUse"
                    >
                      <circle cx="1" cy="1" r="0.5" fill="#7A7440" fillOpacity="0.18" />
                    </pattern>
                  </defs>
                  <rect width="400" height="280" fill="url(#lpDotgrid)" />
                </svg>

                <div className={`${styles.bcard} ${styles.bcardPhoto} ${styles.bp1}`}>
                  <svg
                    viewBox="0 0 60 44"
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="lpPhoto1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#F4E8C9" />
                        <stop offset="0.55" stopColor="#D9C994" />
                        <stop offset="1" stopColor="#9C9658" />
                      </linearGradient>
                    </defs>
                    <rect width="60" height="44" fill="url(#lpPhoto1)" />
                    <circle cx="46" cy="14" r="4" fill="#F2EDE0" opacity="0.85" />
                    <path
                      d="M 0 32 L 14 26 L 28 30 L 42 24 L 60 30 L 60 44 L 0 44 Z"
                      fill="#5C4F3F"
                      opacity="0.35"
                    />
                  </svg>
                </div>

                <div className={`${styles.bcard} ${styles.bcardSnippet} ${styles.bs1}`}>
                  <span className={styles.bsQuote}>“</span>
                  <span className={styles.bsText}>{t('preview.board.snippet.1')}</span>
                </div>

                <div className={`${styles.bcard} ${styles.bcardEntry} ${styles.be1}`}>
                  <span className={styles.beTitle}>{t('preview.board.entry.title')}</span>
                  <span className={styles.beLine} />
                  <span className={styles.beLine} />
                  <span className={`${styles.beLine} ${styles.beLineShort}`} />
                  <span className={styles.beMeta}>{t('preview.board.entry.meta')}</span>
                </div>

                <div className={`${styles.bcard} ${styles.bcardPhoto} ${styles.bp2}`}>
                  <svg
                    viewBox="0 0 60 44"
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="lpPhoto2" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0" stopColor="#E2DCBE" />
                        <stop offset="1" stopColor="#7A7440" />
                      </linearGradient>
                    </defs>
                    <rect width="60" height="44" fill="url(#lpPhoto2)" />
                    <path
                      d="M 8 38 Q 18 18 28 28 Q 36 36 48 22 L 48 44 L 8 44 Z"
                      fill="#5C4F3F"
                      opacity="0.4"
                    />
                  </svg>
                </div>

                <div className={`${styles.bcard} ${styles.bcardSnippet} ${styles.bs2}`}>
                  <span className={styles.bsQuote}>“</span>
                  <span className={styles.bsText}>{t('preview.board.snippet.2')}</span>
                </div>

                <div className={`${styles.bcard} ${styles.bcardPhoto} ${styles.bp3}`}>
                  <svg
                    viewBox="0 0 60 44"
                    preserveAspectRatio="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="lpPhoto3" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0" stopColor="#FBF6E5" />
                        <stop offset="1" stopColor="#C8B989" />
                      </linearGradient>
                    </defs>
                    <rect width="60" height="44" fill="url(#lpPhoto3)" />
                    <circle cx="30" cy="22" r="9" fill="#E8B838" opacity="0.55" />
                  </svg>
                </div>

                <svg
                  className={styles.boardThreads}
                  viewBox="0 0 400 280"
                  preserveAspectRatio="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <line
                    x1="80"
                    y1="60"
                    x2="200"
                    y2="120"
                    stroke="#7A7440"
                    strokeOpacity="0.2"
                    strokeDasharray="2 3"
                  />
                  <line
                    x1="200"
                    y1="120"
                    x2="320"
                    y2="80"
                    stroke="#7A7440"
                    strokeOpacity="0.2"
                    strokeDasharray="2 3"
                  />
                  <line
                    x1="200"
                    y1="120"
                    x2="120"
                    y2="200"
                    stroke="#7A7440"
                    strokeOpacity="0.2"
                    strokeDasharray="2 3"
                  />
                </svg>
              </div>
              <div className={styles.boardFoot}>
                <span>{t('preview.board.label')}</span>
              </div>
            </div>
          </div>
          <figcaption>{t('preview.board.caption')}</figcaption>
        </figure>

        <figure className={`${styles.previewCard} ${styles.previewJar}`}>
          <div className={styles.windowEl}>
            <div className={`${styles.windowRail} ${styles.railMini}`}>
              <div className={styles.railIcons}>
                <div className={`${styles.railIcon} ${styles.railIconActive}`} />
                <div className={styles.railIcon} />
                <div className={styles.railIcon} />
                <div className={styles.railIcon} />
              </div>
            </div>
            <div className={`${styles.windowBody} ${styles.windowBodyJar}`}>
              <svg
                viewBox="0 0 520 360"
                className={styles.jarMini}
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M 230 30 L 230 110 C 230 130, 160 150, 140 220 C 124 280, 200 326, 260 326 C 320 326, 396 280, 380 220 C 360 150, 290 130, 290 110 L 290 30 Z"
                  fill="#F2EDE0"
                  stroke="#7A7440"
                  strokeWidth="1.4"
                  strokeOpacity="0.55"
                />
                <ellipse
                  cx="260"
                  cy="30"
                  rx="30"
                  ry="6"
                  fill="none"
                  stroke="#7A7440"
                  strokeWidth="1.4"
                  strokeOpacity="0.55"
                />
                <g fill="#9C9658" opacity="0.5">
                  <circle cx="260" cy="200" r="9" />
                  <circle cx="240" cy="220" r="6" />
                  <circle cx="280" cy="220" r="6" />
                  <circle cx="260" cy="240" r="5" />
                </g>
                <line
                  x1="120"
                  y1="80"
                  x2="220"
                  y2="160"
                  stroke="#7A7440"
                  strokeOpacity="0.18"
                  strokeDasharray="2 3"
                />
                <line
                  x1="420"
                  y1="80"
                  x2="300"
                  y2="160"
                  stroke="#7A7440"
                  strokeOpacity="0.18"
                  strokeDasharray="2 3"
                />
                <line
                  x1="80"
                  y1="280"
                  x2="200"
                  y2="240"
                  stroke="#7A7440"
                  strokeOpacity="0.18"
                  strokeDasharray="2 3"
                />
                <line
                  x1="460"
                  y1="280"
                  x2="320"
                  y2="240"
                  stroke="#7A7440"
                  strokeOpacity="0.18"
                  strokeDasharray="2 3"
                />
              </svg>
              <div className={styles.jarMiniChips}>
                <span className={`${styles.miniChip} ${styles.mc1}`}>
                  {t('preview.jar.chip.1')}
                </span>
                <span className={`${styles.miniChip} ${styles.mc2}`}>
                  {t('preview.jar.chip.2')}
                </span>
                <span className={`${styles.miniChip} ${styles.mc3}`}>
                  {t('preview.jar.chip.3')}
                </span>
                <span className={`${styles.miniChip} ${styles.mc4}`}>
                  {t('preview.jar.chip.4')}
                </span>
              </div>
              <p className={styles.jarMiniLabel}>{t('preview.jar.label')}</p>
            </div>
          </div>
          <figcaption>{t('preview.jar.caption')}</figcaption>
        </figure>

        <figure className={`${styles.previewCard} ${styles.previewLetter}`}>
          <div className={styles.letterPaper}>
            <p className={styles.letterHeader}>
              <span className={styles.letterFrom}>{t('preview.letter.from')}</span>
              <span>2026.05.03</span>
            </p>
            <p className={styles.letterBody}>{t('preview.letter.body')}</p>
            <p className={styles.letterFoot}>
              <span className={styles.letterStamp} aria-hidden="true">
                ●
              </span>
            </p>
          </div>
          <figcaption>{t('preview.letter.caption')}</figcaption>
        </figure>
      </div>
    </section>
  );
}

function Philosophy({ t }: { t: T }) {
  return (
    <section id="philosophy" className={`${styles.section} ${styles.sectionPhilosophy}`}>
      <div className={styles.sectionHead}>
        <p className={styles.kicker}>{t('philosophy.kicker')}</p>
        <h2 className={styles.sectionTitle}>{t('philosophy.title')}</h2>
      </div>

      <div className={styles.principles}>
        {(['1', '2', '3', '4'] as const).map((n, idx) => (
          <div key={n} className={styles.principle}>
            <p className={styles.principleNum}>{['i', 'ii', 'iii', 'iv'][idx]}</p>
            <h3>{t(`philo.${n}.title`)}</h3>
            <p>{t(`philo.${n}.body`)}</p>
          </div>
        ))}
      </div>

      <div className={styles.lineage}>
        <p className={styles.lineageLabel}>{t('philo.lineage.label')}</p>
        <p className={styles.lineageBody}>{t('philo.lineage.body')}</p>
        <p className={styles.lineageLinks}>
          <a
            href="https://github.com/ephemere-io/pickles"
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/ephemere-io/pickles
          </a>
          <span className={styles.lineageDot}>·</span>
          <a href="https://ephemere.io" target="_blank" rel="noopener noreferrer">
            ephemere.io
          </a>
        </p>
      </div>
    </section>
  );
}

function Faq({ t }: { t: T }) {
  return (
    <section id="faq" className={`${styles.section} ${styles.sectionFaq}`}>
      <div className={styles.sectionHead}>
        <p className={styles.kicker}>{t('faq.kicker')}</p>
        <h2 className={styles.sectionTitle}>{t('faq.title')}</h2>
      </div>
      <ul className={styles.faqList}>
        {(['1', '2', '3', '4', '5'] as const).map((n) => (
          <LandingFaqItem key={n} question={t(`faq.${n}.q`)} answer={t(`faq.${n}.a`)} />
        ))}
      </ul>
    </section>
  );
}

function Outro({ t }: { t: T }) {
  return (
    <section className={styles.outro}>
      <h2 className={styles.outroTitle}>
        <span>{t('outro.l1')}</span>
        <span>{t('outro.l2')}</span>
      </h2>
      <Link className={`${styles.cta} ${styles.ctaBig}`} href={APP_HREF}>
        {t('outro.cta')}
      </Link>
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
          <p className={styles.footTag}>{t('foot.tag')}</p>
        </div>
        <nav className={styles.footNav} aria-label="footer">
          <a href="#concept">{t('nav.concept')}</a>
          <a href="#process">{t('nav.process')}</a>
          <a href="#preview">{t('nav.preview')}</a>
          <a href="#philosophy">{t('nav.philosophy')}</a>
          <a href="#faq">{t('nav.faq')}</a>
          <Link href="/support">{t('nav.support')}</Link>
        </nav>
        <div className={styles.footMeta}>
          <p>© 2026 Ephemere</p>
          <p>
            <a href="https://ephemere.io" target="_blank" rel="noopener noreferrer">
              ephemere.io
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
