import { LanceDBSearch } from '../../../search/lancedb-search.js';

let initPromise: Promise<LanceDBSearch> | null = null;

export function getSearchInstance(): Promise<LanceDBSearch> {
  if (!initPromise) {
    initPromise = (async () => {
      const instance = new LanceDBSearch();
      await instance.initialize();
      return instance;
    })();
  }
  return initPromise;
}

export function resetSearchInstance(): void {
  initPromise = null;
}
