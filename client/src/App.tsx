import { Switch, Route } from "wouter";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import ErrorBoundary from "@/components/ErrorBoundary";
import { getBrand, applyBrandDocument } from "@/lib/brand";

// ── Strategic-tool pages ────────────────────────────────────────────────────
import EngagementList from "@/pages/EngagementList";
import Login from "@/pages/Login";

// Lazy load heavier pages
const EngagementShell = lazy(() => import("@/pages/EngagementShell"));
const DemoEntry = lazy(() => import("@/pages/DemoEntry"));
const AventineElicitationPage = lazy(() => import("@/pages/AventineElicitationPage"));
const SandboxRequestsAdmin = lazy(() => import("@/pages/SandboxRequestsAdmin"));
const CampaignProvisionAdmin = lazy(() => import("@/pages/CampaignProvisionAdmin"));
const MtmotProductPage = lazy(() => import("@/pages/MtmotProductPage"));
import { MtmotHeader } from "@/components/layout/MtmotHeader";
const ResetPasswordPage = lazy(() => import("@/pages/ResetPassword"));
const NotFound = lazy(() => import("@/pages/NotFound"));

const Loading = () => (
  <div className="flex h-screen items-center justify-center">
    <p className="text-muted-foreground">Loading...</p>
  </div>
);

// Host-guard (CC-84): on the MTMOT public-marketing build (VITE_BRAND_IS_MTMOT
// true), admin/console routes are not the product's public front door. If
// configured, VITE_BRAND_ADMIN_REDIRECT_URL bounces them to wherever the
// operator's own console lives instead of exposing a login there; if unset,
// the route simply renders nothing rather than guessing a destination — no
// other operator's domain is ever hardcoded into a client build. A client
// build has VITE_BRAND_IS_MTMOT unset (false), so this guard is inert.
function CarlorbizOnly({ children }: { children: ReactNode }) {
  const brand = getBrand();
  const redirectUrl = (import.meta.env.VITE_BRAND_ADMIN_REDIRECT_URL as string | undefined)?.trim();
  useEffect(() => {
    if (brand.isMtmot && redirectUrl && typeof window !== "undefined") {
      const { pathname, search } = window.location;
      window.location.replace(`${redirectUrl}${pathname}${search}`);
    }
  }, [brand.isMtmot, redirectUrl]);
  if (brand.isMtmot) return <Loading />;
  return <>{children}</>;
}

function App() {
  const brand = getBrand();
  useEffect(() => {
    applyBrandDocument(brand);
  }, [brand]);

  return (
    <AuthProvider>
      <ChatProvider>
        {/* CC-89: the mtmot.com menu header, replicated verbatim on the MTMOT
            host only — the Carlorbiz skin is untouched. */}
        {brand.isMtmot && <MtmotHeader />}
        <Switch>
          {/* ── Public routes ──────────────────────────────── */}
          <Route path="/login" component={Login} />
          <Route path="/reset-password">
            <Suspense fallback={<Loading />}>
              <ResetPasswordPage />
            </Suspense>
          </Route>

          {/* ── Public read-only demo (anonymous session, 3 seeded plans) ─ */}
          <Route path="/demo">
            <ErrorBoundary>
              <Suspense fallback={<Loading />}>
                <DemoEntry />
              </Suspense>
            </ErrorBoundary>
          </Route>

          {/* ── Root: MTMOT product page (public) on the mtmot host;
                 the auth-gated engagement list on the carlorbiz host ─ */}
          <Route path="/">
            {brand.isMtmot ? (
              <ErrorBoundary>
                <Suspense fallback={<Loading />}>
                  <MtmotProductPage />
                </Suspense>
              </ErrorBoundary>
            ) : (
              <EngagementList />
            )}
          </Route>

          {/* ── Aventine strategic-elicitation surface (CC-75; magic-link) ─ */}
          <Route path="/elicit/:engagementId">
            <ErrorBoundary>
              <Suspense fallback={<Loading />}>
                <AventineElicitationPage />
              </Suspense>
            </ErrorBoundary>
          </Route>

          {/* ── Engagement shell (the status/role router) ──── */}
          <Route path="/e/:engagementId">
            <ErrorBoundary>
              <Suspense fallback={<Loading />}>
                <EngagementShell />
              </Suspense>
            </ErrorBoundary>
          </Route>

          {/* ── Sandbox request triage (admin only) ────────── */}
          <Route path="/admin/sandbox">
            <CarlorbizOnly>
              <Suspense fallback={<Loading />}>
                <ProtectedRoute component={SandboxRequestsAdmin} />
              </Suspense>
            </CarlorbizOnly>
          </Route>

          {/* ── Campaign respondent provisioning (admin only) ─ */}
          <Route path="/admin/campaign">
            <CarlorbizOnly>
              <Suspense fallback={<Loading />}>
                <ProtectedRoute component={CampaignProvisionAdmin} />
              </Suspense>
            </CarlorbizOnly>
          </Route>

          {/* ── 404 ────────────────────────────────────────── */}
          <Route>
            <Suspense fallback={<Loading />}>
              <NotFound />
            </Suspense>
          </Route>
        </Switch>
        <Toaster />
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
