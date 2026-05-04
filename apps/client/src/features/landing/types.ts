export type LandingLang = 'ja' | 'en';

export function isLandingLang(value: string): value is LandingLang {
  return value === 'ja' || value === 'en';
}
