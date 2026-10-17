import { useState, useEffect, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    __pwaDeferredPrompt: BeforeInstallPromptEvent | null;
    __pwaPromptFired: boolean;
    __pwaIsInstalled: boolean;
  }
}

/**
 * Custom hook to manage PWA installation with early-captured beforeinstallprompt,
 * native prompt execution, appinstalled tracking, and fallback guidance.
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    return typeof window !== 'undefined' && window.__pwaDeferredPrompt
      ? window.__pwaDeferredPrompt
      : null;
  });

  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    if (window.__pwaIsInstalled) return true;
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if ((window.navigator as any).standalone === true) return true;
    return false;
  });

  const [isIos] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const ua = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
  });

  useEffect(() => {
    // 1. Synchronize with global window.__pwaDeferredPrompt if it was captured before hook mounted
    if (window.__pwaDeferredPrompt && !deferredPrompt) {
      setDeferredPrompt(window.__pwaDeferredPrompt);
    }

    // 2. Custom event dispatched when early head-script catches beforeinstallprompt
    const handleEarlyReady = (e: any) => {
      const promptEvent = e.detail || window.__pwaDeferredPrompt;
      if (promptEvent) {
        setDeferredPrompt(promptEvent);
      }
    };

    // 3. Native beforeinstallprompt event handler
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.__pwaDeferredPrompt = promptEvent;
      window.__pwaPromptFired = true;
      setDeferredPrompt(promptEvent);
      console.log('[PWA] Native beforeinstallprompt received and deferred.');
    };

    // 4. Native appinstalled event handler
    const handleAppInstalled = () => {
      window.__pwaDeferredPrompt = null;
      window.__pwaIsInstalled = true;
      setDeferredPrompt(null);
      setIsInstalled(true);
      console.log('[PWA] Application successfully installed.');
    };

    window.addEventListener('pwa-deferred-prompt-ready', handleEarlyReady);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('pwa-app-installed', handleAppInstalled);

    return () => {
      window.removeEventListener('pwa-deferred-prompt-ready', handleEarlyReady);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('pwa-app-installed', handleAppInstalled);
    };
  }, [deferredPrompt]);

  /**
   * Triggers the installation flow.
   * If native beforeinstallprompt is ready, calls .prompt() and awaits user choice.
   * If unavailable, returns 'manual_fallback' so the UI can display manual steps.
   */
  const triggerInstall = useCallback(async (): Promise<{
    status: 'accepted' | 'dismissed' | 'manual_fallback';
    method: 'native' | 'manual';
  }> => {
    const activePrompt = deferredPrompt || window.__pwaDeferredPrompt;

    if (activePrompt) {
      try {
        console.log('[PWA] Invoking native installation prompt...');
        await activePrompt.prompt();
        const choice = await activePrompt.userChoice;
        console.log('[PWA] User response to native prompt:', choice.outcome);

        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
        }

        // Deferred prompt can only be used once per spec; clear it
        setDeferredPrompt(null);
        window.__pwaDeferredPrompt = null;

        return { status: choice.outcome, method: 'native' };
      } catch (err) {
        console.warn('[PWA] Error triggering native prompt:', err);
        setDeferredPrompt(null);
        window.__pwaDeferredPrompt = null;
        return { status: 'manual_fallback', method: 'manual' };
      }
    }

    // Native prompt is not available
    return { status: 'manual_fallback', method: 'manual' };
  }, [deferredPrompt]);

  return {
    deferredPrompt,
    hasNativePrompt: Boolean(deferredPrompt || (typeof window !== 'undefined' && window.__pwaDeferredPrompt)),
    isInstalled,
    isIos,
    triggerInstall,
  };
}
