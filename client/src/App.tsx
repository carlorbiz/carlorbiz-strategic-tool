import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
import { CMSProvider } from "@/contexts/CMSContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";

// ── Strategic-tool pages ────────────────────────────────────────────────────
import EngagementList from "@/pages/EngagementList";
import Login from "@/pages/Login";

// Lazy load heavier pages
const EngagementShell = lazy(() => import("@/pages/EngagementShell"));
const Admin = lazy(() => import("@/pages/Admin"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPassword"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const Loading = () => (
  <div className="flex h-screen items-center justify-center">
    <p className="text-muted-foreground">Loading...</p>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <CMSProvider>
          <Switch>
            {/* ── Public routes ──────────────────────────────── */}
            <Route path="/login" component={Login} />
            <Route path="/reset-password">
              <Suspense fallback={<Loading />}>
                <ResetPasswordPage />
              </Suspense>
            </Route>

            {/* ── Engagement list (landing page, requires auth) ─ */}
            <Route path="/" component={EngagementList} />

            {/* ── Engagement shell (the status/role router) ──── */}
            <Route path="/e/:engagementId">
              <ErrorBoundary>
                <Suspense fallback={<Loading />}>
                  <EngagementShell />
                </Suspense>
              </ErrorBoundary>
            </Route>

            {/* ── Global admin (internal_admin only) ─────────── */}
            <Route path="/admin">
              <Suspense fallback={<Loading />}>
                <ProtectedRoute component={Admin} />
              </Suspense>
            </Route>

            {/* ── 404 ────────────────────────────────────────── */}
            <Route>
              <Suspense fallback={<Loading />}>
                <NotFound />
              </Suspense>
            </Route>
          </Switch>
          <Toaster />
        </CMSProvider>
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
