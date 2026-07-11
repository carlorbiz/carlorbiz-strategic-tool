import { Switch, Route } from "wouter";
import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { CMSProvider } from "@/contexts/CMSContext";
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
const Admin = lazy(() => import("@/pages/Admin"));
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

// Host-guard (CC-84): the mtmot host (strategy.mtmot.com) is the public,
// demo-only product surface — admin/console routes belong to the Carlorbiz
// consulting instance. If an admin route is reached on the mtmot host, bounce
// it to the same path on strategy.carlorbiz.com.au rather than exposing a login
// on the product front door. Non-mtmot hosts render the route unchanged.
function CarlorbizOnly({ children }: { children: ReactNode }) {
  const brand = getBrand();
  useEffect(() => {
    if (brand.isMtmot && typeof window !== "undefined") {
      const { pathname, search } = window.location;
      window.location.replace(`https://strategy.carlorbiz.com.au${pathname}${search}`);
    }
  }, [brand.isMtmot]);
  if (brand.isMtmot) return <Loading />;
  return <>{children}</>;
}

function App() {
  const brand = getBrand();
  useEffect(() => {
    applyBrandDocument(brand);
  }, [brand.key]);

  return (
    <AuthProvider>
      <ChatProvider>
        <CMSProvider>
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

            {/* ── Global admin (internal_admin only) ─────────── */}
            <Route path="/admin">
              <CarlorbizOnly>
                <Suspense fallback={<Loading />}>
                  <ProtectedRoute component={Admin} />
                </Suspense>
              </CarlorbizOnly>
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
        </CMSProvider>
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
