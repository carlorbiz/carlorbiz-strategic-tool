import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Listens for service worker updates and shows a non-intrusive toast
 * prompting the user to refresh for the latest version.
 */
export function UpdatePrompt() {
  const [showUpdate, setShowUpdate] = useState(false);

  useEffect(() => {
    // Listen for UPDATE_AVAILABLE message from service worker
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'UPDATE_AVAILABLE') {
        setShowUpdate(true);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    // Also check if there's a waiting service worker on mount
    // (in case the update happened before this component mounted)
    navigator.serviceWorker?.ready.then((registration) => {
      if (registration.waiting) {
        setShowUpdate(true);
      }

      // Listen for new service workers installing
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            setShowUpdate(true);
          }
        });
      });
    });

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!showUpdate) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-3 bg-[#2D7E32] text-white rounded-full shadow-lg px-5 py-3 font-body text-sm">
        <RefreshCw className="h-4 w-4 flex-shrink-0" />
        <span>A new version is available</span>
        <button
          onClick={handleRefresh}
          className="bg-white/20 hover:bg-white/30 rounded-full px-4 py-1 font-semibold text-xs transition-colors"
        >
          Refresh
        </button>
        <button
          onClick={() => setShowUpdate(false)}
          className="text-white/60 hover:text-white text-xs ml-1"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
