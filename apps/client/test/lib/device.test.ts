import { describe, expect, it } from 'vitest';
import { detectDeviceFromUA, isDevice } from '@/lib/device';

describe('detectDeviceFromUA', () => {
  it('モバイル UA は sp', () => {
    expect(
      detectDeviceFromUA(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      ),
    ).toBe('sp');
    expect(detectDeviceFromUA('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')).toBe(
      'sp',
    );
  });

  it('デスクトップ UA は pc', () => {
    expect(
      detectDeviceFromUA(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      ),
    ).toBe('pc');
  });

  it('UA が無い/空なら pc にフォールバック', () => {
    expect(detectDeviceFromUA(null)).toBe('pc');
    expect(detectDeviceFromUA('')).toBe('pc');
  });
});

describe('isDevice', () => {
  it('pc / sp のみ true', () => {
    expect(isDevice('pc')).toBe(true);
    expect(isDevice('sp')).toBe(true);
  });
  it('それ以外は false', () => {
    expect(isDevice('tablet')).toBe(false);
    expect(isDevice(null)).toBe(false);
    expect(isDevice(undefined)).toBe(false);
  });
});
