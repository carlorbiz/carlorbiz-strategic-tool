import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const handleCallback = async () => {
      if (!supabase) {
        navigate('/');
        return;
      }

      // Supabase handles the token exchange from the URL hash automatically
      const { error } = await supabase.auth.getSession();
      if (error) {
        console.error('Auth callback error:', error);
      }

      // Redirect to home or the stored return path
      const returnPath = sessionStorage.getItem('auth_return_path') || '/';
      sessionStorage.removeItem('auth_return_path');
      navigate(returnPath);
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Completing sign-in...</p>
      </div>
    </div>
  );
}
