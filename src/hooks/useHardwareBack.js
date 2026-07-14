import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export const useHardwareBack = (handler) => {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let listener = null;
    
    const setupListener = async () => {
      listener = await App.addListener('backButton', handler);
    };
    
    setupListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, [handler]);
};
