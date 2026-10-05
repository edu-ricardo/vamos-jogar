import { describe, expect, it } from 'vitest';
import { base64UrlToBytes, isAppleMobile } from './notificationService';

describe('base64UrlToBytes', () => {
  it('converte a chave VAPID (base64url, sem preenchimento) em bytes', () => {
    // "+/8" em base64 vira "-_8" em base64url: bytes 0xFB 0xFF
    expect([...base64UrlToBytes('-_8')]).toEqual([0xfb, 0xff]);
    expect([...base64UrlToBytes('AQID')]).toEqual([1, 2, 3]);
  });
});

describe('isAppleMobile', () => {
  const nav = (userAgent: string, platform = '', maxTouchPoints = 0) =>
    ({ userAgent, platform, maxTouchPoints }) as Navigator;

  it('reconhece iPhone e iPad (inclusive o iPad que se apresenta como Mac)', () => {
    expect(isAppleMobile(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'))).toBe(true);
    expect(isAppleMobile(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 5))).toBe(true);
  });

  it('não confunde com Mac, Android ou Windows', () => {
    expect(isAppleMobile(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel', 0))).toBe(
      false,
    );
    expect(isAppleMobile(nav('Mozilla/5.0 (Linux; Android 15)', 'Linux armv8l', 5))).toBe(false);
    expect(isAppleMobile(nav('Mozilla/5.0 (Windows NT 10.0)', 'Win32', 0))).toBe(false);
  });
});
