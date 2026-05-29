import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Result of async data fetching
 */
export interface AsyncDataResult<T> {
  /** The fetched data, null if not loaded yet */
  data: T | null;
  /** Whether data is currently being loaded */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Function to reload the data */
  reload: () => Promise<void>;
}

/**
 * Options for useAsyncData hook
 */
export interface UseAsyncDataOptions {
  /** Whether to fetch data immediately on mount (default: true) */
  immediate?: boolean;
  /** Reset data to null before reloading (default: false) */
  resetOnReload?: boolean;
}

/**
 * Internal hook that handles the core async data fetching logic.
 * Used by both useAsyncData and useAsyncDataWhen to avoid code duplication.
 */
function useAsyncDataCore<T>(
  fetcher: () => Promise<T>,
  options: { resetOnReload?: boolean; initialLoading?: boolean } = {}
): AsyncDataResult<T> & { triggerFetch: () => void } {
  const { resetOnReload = false, initialLoading = false } = options;

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(initialLoading);
  const [error, setError] = useState<string | null>(null);

  // Track if component is mounted to prevent state updates after unmount
  const mountedRef = useRef(true);
  // Track the current fetch to handle race conditions
  const fetchIdRef = useRef(0);
  // Store fetcher in ref to avoid recreating reload callback
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    const currentFetchId = ++fetchIdRef.current;

    if (resetOnReload) {
      setData(null);
    }
    setLoading(true);
    setError(null);

    try {
      const result = await fetcherRef.current();

      // Only update state if this is still the latest fetch and component is mounted
      if (mountedRef.current && currentFetchId === fetchIdRef.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current && currentFetchId === fetchIdRef.current) {
        const message = err instanceof Error ? err.message : 'An error occurred';
        setError(message);
      }
    } finally {
      if (mountedRef.current && currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [resetOnReload]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { data, loading, error, reload, triggerFetch: reload };
}

/**
 * Async data fetching with loading/error state and reload.
 * @param fetcher - returns the data
 * @param deps - refetch when these change
 */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
  options: UseAsyncDataOptions = {}
): AsyncDataResult<T> {
  const { immediate = true, resetOnReload = false } = options;

  const { data, loading, error, reload } = useAsyncDataCore(fetcher, {
    resetOnReload,
    initialLoading: immediate
  });

  useEffect(() => {
    if (immediate) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, immediate]);

  return { data, loading, error, reload };
}

/**
 * Conditional async data fetching, only runs when `condition` is true.
 */
export function useAsyncDataWhen<T>(
  condition: boolean,
  fetcher: () => Promise<T>,
  deps: React.DependencyList = []
): AsyncDataResult<T> {
  const { data, loading: coreLoading, error, reload } = useAsyncDataCore(fetcher);

  // Fetch only when condition is true
  useEffect(() => {
    if (condition) {
      reload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [condition, ...deps]);

  // Show loading when condition is true but data hasn't been fetched yet
  const loading = coreLoading || (condition && data === null && error === null);

  return { data, loading, error, reload };
}
