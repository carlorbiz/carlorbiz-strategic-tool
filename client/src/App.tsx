import { Toaster } from 'sonner';
import { Route, Switch } from 'wouter';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Home from '@/pages/Home';
import Briefing from '@/pages/Briefing';
import PreMeeting from '@/pages/PreMeeting';
import Workshop from '@/pages/Workshop';
import WorkshopJoin from '@/pages/WorkshopJoin';
import AdminDashboard from '@/pages/AdminDashboard';
import AuthCallback from '@/pages/AuthCallback';
import NotFound from '@/pages/NotFound';

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/briefing" component={Briefing} />
      <Route path="/briefing/:sessionId" component={Briefing} />
      <Route path="/pre-meeting/:sessionId" component={PreMeeting} />
      <Route path="/workshop/:sessionId" component={Workshop} />
      <Route path="/join/:accessToken" component={WorkshopJoin} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <AuthProvider>
        <Toaster richColors position="top-right" />
        <Router />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
