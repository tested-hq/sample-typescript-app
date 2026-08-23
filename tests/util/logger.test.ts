import { afterEach, describe, expect, it, vi } from 'vitest';
import { debug, error, getLevel, info, setLevel, warn } from '../../src/util/logger.js';

const originalLevel = getLevel();

afterEach(() => {
  setLevel(originalLevel);
  vi.restoreAllMocks();
});

describe('setLevel / getLevel', () => {
  it('reads back the level that was set', () => {
    setLevel('debug');
    expect(getLevel()).toBe('debug');
    setLevel('error');
    expect(getLevel()).toBe('error');
  });
});

describe('level filtering', () => {
  it('suppresses debug when the current level is info', () => {
    setLevel('info');
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    debug('hidden');
    info('shown');

    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledOnce();
    expect(String(infoSpy.mock.calls[0]?.[0])).toMatch(/ INFO shown$/);
  });

  it('emits debug when the level is debug', () => {
    setLevel('debug');
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    debug('visible');
    expect(debugSpy).toHaveBeenCalledOnce();
    expect(String(debugSpy.mock.calls[0]?.[0])).toMatch(/ DEBUG visible$/);
  });

  it('suppresses info and warn at error level', () => {
    setLevel('error');
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    info('no');
    warn('no');
    error('yes');

    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});

describe('message formatting', () => {
  it('appends meta as a JSON suffix', () => {
    setLevel('info');
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    info('placed', { orderId: 'ord_1', cents: 100 });
    expect(String(infoSpy.mock.calls[0]?.[0])).toMatch(
      / INFO placed \{"orderId":"ord_1","cents":100\}$/,
    );
  });

  it('omits the suffix when meta is empty or absent', () => {
    setLevel('warn');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warn('plain');
    warn('also-plain', {});
    expect(String(warnSpy.mock.calls[0]?.[0])).toMatch(/ WARN plain$/);
    expect(String(warnSpy.mock.calls[1]?.[0])).toMatch(/ WARN also-plain$/);
  });
});
