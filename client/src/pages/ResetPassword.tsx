import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [, setLocation] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      if (!isSupabaseConfigured() || !supabase) {
        if (mounted) {
          setHasSession(false);
          setChecking(false);
        }
        return;
      }

      const url = new URL(window.location.href);
      const error = url.searchParams.get("error");
      const errorDescription = url.searchParams.get("error_description");
      if (error) {
        if (mounted) {
          setLinkError(errorDescription || error);
          setHasSession(false);
          setChecking(false);
        }
        return;
      }

      const code = url.searchParams.get("code");
      const accessToken = url.searchParams.get("access_token");
      const refreshToken = url.searchParams.get("refresh_token");

      if (code) {
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (mounted) {
            setLinkError(exchangeError.message || "Reset link is invalid or expired");
            setHasSession(false);
            setChecking(false);
          }
          return;
        }
        if (data?.session) {
          window.history.replaceState({}, document.title, url.pathname);
        }
      } else if (accessToken && refreshToken) {
        const { data, error: setError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (setError) {
          if (mounted) {
            setLinkError(setError.message || "Reset link is invalid or expired");
            setHasSession(false);
            setChecking(false);
          }
          return;
        }
        if (data?.session) {
          window.history.replaceState({}, document.title, url.pathname);
        }
      }

      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setHasSession(!!data.session);
        setChecking(false);
      }
    }

    void checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    if (password.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        toast.error(error.message || "Could not update password");
        return;
      }
      toast.success("Password updated. You can sign in now.");
      setLocation("/login");
    } catch (error: any) {
      toast.error(error?.message || "Could not update password");
    } finally {
      setLoading(false);
    }
  };

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Password Reset</CardTitle>
            <CardDescription>Supabase configuration required</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => setLocation("/login")}>
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (checking) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  if (!hasSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Password Reset</CardTitle>
            <CardDescription>Open this page from the reset link in your email</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {linkError ? (
              <p className="text-sm text-destructive">
                Reset link error: {decodeURIComponent(linkError)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                If your reset link expired, go back and request a new one.
              </p>
            )}
            <Button className="w-full" onClick={() => setLocation("/login")}>
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-heading">Set New Password</CardTitle>
          <CardDescription>Choose a new password for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Updating password..." : "Update Password"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <Button variant="link" className="text-sm text-muted-foreground" onClick={() => setLocation("/login")}>
              Back to Login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
