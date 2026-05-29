// Consistent modal exit animation with double-trigger guard and pre/post-close callbacks

import { useState, useCallback, useRef } from 'react';

interface UseModalExitAnimationOptions {
  onClose: () => void;
  duration?: number;
  onExiting?: () => void;
}

interface UseModalExitAnimationReturn {
  isExiting: boolean;
  handleClose: () => void;
  handleAction: (action: () => void) => void;
}

export function useModalExitAnimation({
  onClose,
  duration = 200,
  onExiting,
}: UseModalExitAnimationOptions): UseModalExitAnimationReturn {
  const [isExiting, setIsExiting] = useState(false);
  const isExitingRef = useRef(false);

  const triggerExit = useCallback(
    (callback?: () => void) => {
      if (isExitingRef.current) return;
      isExitingRef.current = true;
      setIsExiting(true);

      // Call onExiting callback (e.g., disable settings, save state)
      onExiting?.();

      setTimeout(() => {
        setIsExiting(false);
        isExitingRef.current = false;
        callback?.();
        onClose();
      }, duration);
    },
    [onClose, duration, onExiting]
  );

  const handleClose = useCallback(() => {
    triggerExit();
  }, [triggerExit]);

  const handleAction = useCallback((action: () => void) => {
    triggerExit(action);
  }, [triggerExit]);

  return {
    isExiting,
    handleClose,
    handleAction,
  };
}
