import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<'magic' | 'password' | 'reset'>('password');
  const [resetLoading, setResetLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { signIn, isAuthenticated, isLoading, profile } = useAuth();

  // Handle magic-link / OTP redirects
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) return;
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const accessToken = url.searchParams.get("access_token");
    const refreshToken = url.searchParams.get("refresh_token");
    const error = url.searchParams.get("error");
    const errorDescription = url.searchParams.get("error_description");

    if (error) {
      toast.error(decodeURIComponent(errorDescription || error));
      window.history.replaceState({}, document.title, url.pathname);
      return;
    }

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
        if (exchangeError) {
          toast.error(exchangeError.message || "Login link is invalid or expired");
        }
        window.history.replaceState({}, document.title, url.pathname);
      });
      return;
    }

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error: setError }) => {
          if (setError) {
            toast.error(setError.message || "Login link is invalid or expired");
          }
          window.history.replaceState({}, document.title, url.pathname);
        });
    }
  }, []);

  // If already authenticated, redirect based on role
  // But skip if auth is still loading (user may have just signed out)
  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && profile) {
      const isAdmin = profile.role === 'internal_admin' || profile.role === 'client_admin';
      window.location.href = isAdmin ? '/admin' : '/';
    }
  }, [isAuthenticated, profile, isLoading]);

  // If Supabase isn't configured, show setup message
  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-heading">Login</CardTitle>
            <CardDescription>Supabase configuration required</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To enable login, configure Supabase by adding these environment variables:
            </p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>VITE_SUPABASE_URL</li>
              <li>VITE_SUPABASE_ANON_KEY</li>
            </ul>
            <Button variant="outline" className="w-full" onClick={() => setLocation("/")}>
              Return to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await signIn(email, password);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Logged in successfully");
      // The useEffect above handles the redirect once profile loads
    } catch (error: any) {
      toast.error(error.message || "Failed to login");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Enter your email address first");
      return;
    }
    if (!supabase) {
      toast.error("Supabase is not configured");
      return;
    }

    setResetLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      });
      if (error) {
        toast.error(error.message || "Could not send reset email");
        return;
      }
      toast.success("Password reset email sent. Check your inbox and spam folder.");
    } catch (error: any) {
      toast.error(error?.message || "Could not send reset email");
    } finally {
      setResetLoading(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email.trim()) {
      toast.error("Enter your email address first");
      return;
    }
    if (!supabase) {
      toast.error("Supabase is not configured");
      return;
    }

    setOtpLoading(true);
    try {
      const redirectTo = `${window.location.origin}/login`;
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        toast.error(error.message || "Could not send magic link");
        return;
      }
      toast.success("Magic link sent. Check your inbox and spam folder.");
    } catch (error: any) {
      toast.error(error?.message || "Could not send magic link");
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-heading">Team Login</CardTitle>
          <CardDescription>
            {loginMode === 'reset'
              ? "Enter your email to receive a password reset link"
              : loginMode === 'password'
                ? "Sign in with your password"
                : "We'll email you a secure sign-in link"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              if (loginMode === 'reset') return handleForgotPassword(e);
              if (loginMode === 'password') return handleLogin(e);
              e.preventDefault();
              void handleMagicLink();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            {loginMode === 'password' && (
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={
                loginMode === 'reset'
                  ? resetLoading
                  : loginMode === 'password'
                    ? loading
                    : otpLoading
              }
            >
              {loginMode === 'reset'
                ? (resetLoading ? "Sending reset link..." : "Send Reset Link")
                : loginMode === 'password'
                  ? (loading ? "Signing in..." : "Sign In")
                  : (otpLoading ? "Sending link..." : "Send Magic Link")}
            </Button>
            {loginMode !== 'password' && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => setLoginMode('password')}
              >
                Use Password Instead
              </Button>
            )}
          </form>
          <div className="mt-3 text-center">
            <Button
              variant="link"
              className="text-sm"
              onClick={() => setLoginMode((v) => v === 'reset' ? 'magic' : 'reset')}
            >
              {loginMode === 'reset' ? "Back to Magic Link" : "Forgot password?"}
            </Button>
          </div>
          <div className="mt-4 text-center">
            <Button variant="link" className="text-sm text-muted-foreground" onClick={() => setLocation("/")}>
              Back to site
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
