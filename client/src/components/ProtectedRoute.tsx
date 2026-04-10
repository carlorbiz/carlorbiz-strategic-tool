import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, hasAnyRole } = useAuth();
  const [, setLocation] = useLocation();
  // Track whether we've ever been authenticated in this mount.
  // Once authenticated, we NEVER redirect — even if React auth state
  // flickers to null (tab switch, background GC, transient state).
  const wasAuthenticated = useRef(false);
  const [showRelogin, setShowRelogin] = useState(false);

  const isAdmin = hasAnyRole(['internal_admin', 'client_admin']);

  if (isAuthenticated && isAdmin) {
    wasAuthenticated.current = true;
    if (showRelogin) setShowRelogin(false);
  }

  useEffect(() => {
    if (isLoading) return;
    if (!isSupabaseConfigured()) return;

    // If we were never authenticated in this mount, check localStorage
    // directly — the React state may not have caught up yet
    if (!isAuthenticated && !wasAuthenticated.current) {
      const hasStoredSession = Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      if (hasStoredSession) {
        // Session exists in storage but React hasn't loaded it yet — wait
        return;
      }
      // No session at all — redirect to login
      setLocation("/login");
      return;
    }

    // If we WERE authenticated but now aren't, don't redirect.
    // Show an inline re-login prompt instead so the user doesn't lose context.
    if (wasAuthenticated.current && !isAuthenticated) {
      setShowRelogin(true);
    }
  }, [isLoading, isAuthenticated, isAdmin, setLocation]);

  if (!isSupabaseConfigured()) {
    return <Component />;
  }

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  // Never accessed admin before in this session and no stored session
  if (!isAuthenticated && !wasAuthenticated.current) {
    return null;
  }

  // Session flickered — show inline prompt, NOT a redirect
  if (showRelogin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4 max-w-md px-6">
          <h2 className="text-xl font-semibold">Session expired</h2>
          <p className="text-muted-foreground">
            Your session has timed out. Your work has been saved — click below to sign back in.
          </p>
          <button
            onClick={() => window.location.replace('/login')}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90"
          >
            Sign back in
          </button>
        </div>
      </div>
    );
  }

  return <Component />;
}
