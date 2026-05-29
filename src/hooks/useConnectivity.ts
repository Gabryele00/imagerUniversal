// Poll backend connectivity every 30s; starts optimistic (online) until the first check

import { useState, useEffect, useRef, useCallback } from 'react';
import { checkConnectivity } from './useTauri';
import { POLLING } from '../config';

interface ConnectivityState {
  /** Whether the app can reach the Armbian API */
  isOnline: boolean;
}

export function useConnectivity(): ConnectivityState {
  const [isOnline, setIsOnline] = useState(true); // Optimistic default
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    try {
      const online = await checkConnectivity();
      if (mountedRef.current) {
        setIsOnline(online);
      }
    } catch {
      if (mountedRef.current) {
        setIsOnline(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Initial check
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial connectivity check on mount
    check();

    // Poll every 30 seconds
    const interval = setInterval(check, POLLING.CONNECTIVITY_CHECK);

    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [check]);

  return { isOnline };
}
