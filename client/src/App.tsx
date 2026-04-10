import { Switch, Route } from "wouter";
import { lazy, Suspense } from "react";
// SidebarProvider removed — not used on Carlorbiz site, was constraining page width
import { CMSProvider } from "@/contexts/CMSContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ChatProvider } from "@/contexts/ChatContext";
import Home from "@/pages/Home";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import AboutMe from "@/pages/AboutMe";
import Services from "@/pages/Services";
import Insights from "@/pages/Insights";
import Contact from "@/pages/Contact";
import CampaignLanding from "@/pages/CampaignLanding";
import { CAMPAIGNS } from "@/data/campaigns";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Toaster } from "@/components/ui/sonner";
import { NeraChatbot } from "@/components/chat";

// Lazy load heavy pages to reduce initial bundle size
const Admin = lazy(() => import("@/pages/Admin"));
const FeedbackPage = lazy(() => import("@/pages/FeedbackPage"));
const FollowUpPage = lazy(() => import("@/pages/FollowUpPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPassword"));
const NeraDemoPage = lazy(() => import("@/pages/NeraDemoPage"));

/** Only render Nera for authenticated users (TPAs / employees) */
function AuthenticatedNera() {
  const { user } = useAuth();
  if (!user) return null;
  return <NeraChatbot />;
}

function App() {
  return (
    <AuthProvider>
      <ChatProvider>
        <CMSProvider>
            <Switch>
              <Route path="/" component={Landing} />
              <Route path="/services" component={Services} />
              <Route path="/about-me" component={AboutMe} />
              <Route path="/contact" component={Contact} />
              <Route path="/insights" component={Insights} />
              <Route path="/lp/:slug">
                <CampaignLanding campaigns={CAMPAIGNS} />
              </Route>
              <Route path="/hub" component={Home} />
              <Route path="/login" component={Login} />
              <Route path="/nera-demo">
                <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
                  <NeraDemoPage />
                </Suspense>
              </Route>
              <Route path="/reset-password">
                <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
                  <ResetPasswordPage />
                </Suspense>
              </Route>
              <Route path="/admin">
                <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
                  <ProtectedRoute component={Admin} />
                </Suspense>
              </Route>
              <Route path="/feedback/:campaignSlug">
                <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
                  <FeedbackPage />
                </Suspense>
              </Route>
              <Route path="/follow-up">
                <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading...</div>}>
                  <FollowUpPage />
                </Suspense>
              </Route>
              <Route>404 Page Not Found</Route>
            </Switch>
            <Toaster />
            <AuthenticatedNera />
        </CMSProvider>
      </ChatProvider>
    </AuthProvider>
  );
}

export default App;
