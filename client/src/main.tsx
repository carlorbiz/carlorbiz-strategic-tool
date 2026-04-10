import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import { UpdatePrompt } from "./components/UpdatePrompt";
import "./index.css";

// Clean up Supabase auth tokens from the URL hash IMMEDIATELY.
// supabase-js reads window.location.hash synchronously during createClient(),
// which happens at module import time (before this code runs). By the time
// main.tsx executes, the token has already been consumed. Strip it now.
if (window.location.hash.includes('access_token')) {
  // Preserve any meaningful hash before the token (e.g. #see-it-working)
  const match = window.location.hash.match(/^#([^#&]+?)(?:#|&|$)/);
  const preserveHash = match?.[1] && !match[1].includes('=') ? `#${match[1]}` : '';
  window.history.replaceState(null, '', `${window.location.pathname}${preserveHash}`);
}

// Register service worker for PWA update prompts + offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
    <UpdatePrompt />
  </HelmetProvider>
);
