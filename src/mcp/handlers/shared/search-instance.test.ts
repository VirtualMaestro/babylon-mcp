import { describe, it, expect, vi, afterEach } from 'vitest';
import { LanceDBSearch } from '../../../search/lancedb-search.js';
import { getSearchInstance, resetSearchInstance } from './search-instance.js';

vi.mock('../../../search/lancedb-search.js', () => {
  const LanceDBSearch = vi.fn().mockImplementation(function (this: any) {
    this.initialize = vi.fn().mockResolvedValue(undefined);
    this.search = vi.fn();
    this.close = vi.fn();
  });
  return { LanceDBSearch };
});

describe('search-instance', () => {
  afterEach(() => {
    resetSearchInstance();
    vi.clearAllMocks();
  });

  describe('getSearchInstance', () => {
    it('returns a LanceDBSearch instance', async () => {
      const instance = await getSearchInstance();

      expect(instance).toBeDefined();
      expect(LanceDBSearch).toHaveBeenCalledOnce();
    });

    it('calls initialize() on the instance', async () => {
      const instance = await getSearchInstance();

      expect(instance.initialize).toHaveBeenCalledOnce();
    });

    it('returns the same instance on subsequent calls', async () => {
      const first = await getSearchInstance();
      const second = await getSearchInstance();

      expect(first).toBe(second);
      expect(LanceDBSearch).toHaveBeenCalledOnce();
    });
  });

  describe('race condition prevention', () => {
    it('concurrent calls all return the same instance', async () => {
      const promises = Array.from({ length: 10 }, () => getSearchInstance());
      const results = await Promise.all(promises);

      const first = results[0];
      for (const result of results) {
        expect(result).toBe(first);
      }
      expect(LanceDBSearch).toHaveBeenCalledOnce();
    });

    it('initialize is called exactly once with concurrent access', async () => {
      const promises = Array.from({ length: 10 }, () => getSearchInstance());
      const results = await Promise.all(promises);

      expect(results[0]!.initialize).toHaveBeenCalledOnce();
    });
  });

  describe('resetSearchInstance', () => {
    it('allows creating a new instance after reset', async () => {
      const first = await getSearchInstance();
      resetSearchInstance();
      const second = await getSearchInstance();

      expect(first).not.toBe(second);
      expect(LanceDBSearch).toHaveBeenCalledTimes(2);
    });

    it('creates a fresh instance that is independently initialized', async () => {
      const first = await getSearchInstance();
      expect(first.initialize).toHaveBeenCalledOnce();

      resetSearchInstance();

      const second = await getSearchInstance();
      expect(second.initialize).toHaveBeenCalledOnce();
      expect(LanceDBSearch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('rejects when initialize() throws and retries after reset', async () => {
      const initError = new Error('Init failed');
      vi.mocked(LanceDBSearch).mockImplementationOnce(function (this: any) {
        this.initialize = vi.fn().mockRejectedValue(initError);
        this.search = vi.fn();
        this.close = vi.fn();
      } as any);

      await expect(getSearchInstance()).rejects.toThrow('Init failed');

      resetSearchInstance();

      vi.mocked(LanceDBSearch).mockImplementationOnce(function (this: any) {
        this.initialize = vi.fn().mockResolvedValue(undefined);
        this.search = vi.fn();
        this.close = vi.fn();
      } as any);

      const instance = await getSearchInstance();
      expect(instance).toBeDefined();
      expect(instance.initialize).toHaveBeenCalledOnce();
    });
  });
});
