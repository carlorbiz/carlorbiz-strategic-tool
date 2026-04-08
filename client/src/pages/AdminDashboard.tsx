import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
  ArrowLeft, Plus, Settings, Users, FileText, Archive,
  Loader2, Trash2, Edit, Eye, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';

type AdminTab = 'sessions' | 'config' | 'branding';

interface SessionRow {
  id: string;
  name: string;
  client_name: string;
  status: string;
  access_token: string;
  created_at: string;
}

export default function AdminDashboard() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<AdminTab>('sessions');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  // New session form
  const [showNewSession, setShowNewSession] = useState(false);
  const [newSession, setNewSession] = useState({
    name: '',
    client_name: '',
    description: '',
  });

  // Config
  const [config, setConfig] = useState({
    app_title: 'Carlorbiz Strategic Planning Toolkit',
    primary_colour: '#2D7E32',
    accent_colour: '#D5B13A',
    facilitator_name: 'Carla',
  });

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate('/');
      return;
    }

    if (!supabase) {
      setLoading(false);
      return;
    }

    const loadSessions = async () => {
      const { data } = await supabase!
        .from('workshop_sessions')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setSessions(data);
      setLoading(false);
    };

    loadSessions();
  }, [authLoading, isAdmin, navigate]);

  const createSession = async () => {
    if (!supabase || !newSession.name) return;

    const accessToken = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

    const { data, error } = await supabase
      .from('workshop_sessions')
      .insert({
        name: newSession.name,
        client_name: newSession.client_name,
        description: newSession.description,
        status: 'draft',
        access_token: accessToken,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to create session: ' + error.message);
      return;
    }

    if (data) {
      setSessions((prev) => [data, ...prev]);
      setNewSession({ name: '', client_name: '', description: '' });
      setShowNewSession(false);
      toast.success('Session created successfully');
    }
  };

  const updateSessionStatus = async (id: string, status: string) => {
    if (!supabase) return;
    await supabase.from('workshop_sessions').update({ status }).eq('id', id);
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    toast.success(`Session ${status}`);
  };

  const deleteSession = async (id: string) => {
    if (!supabase || !confirm('Are you sure? This will delete all session data.')) return;
    await supabase.from('workshop_sessions').delete().eq('id', id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast.success('Session deleted');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-muted-foreground hover:text-foreground no-underline">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="font-heading font-semibold text-foreground">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">
                Manage sessions, configuration, and branding
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Bar */}
      <div className="border-b border-border bg-card">
        <div className="container flex gap-1">
          {([
            { id: 'sessions' as const, label: 'Sessions', icon: Users },
            { id: 'config' as const, label: 'Configuration', icon: Settings },
            { id: 'branding' as const, label: 'Branding', icon: Edit },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="container py-6">
        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-heading text-xl font-bold text-foreground">
                Workshop Sessions ({sessions.length})
              </h2>
              <button
                onClick={() => setShowNewSession(!showNewSession)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                New Session
              </button>
            </div>

            {showNewSession && (
              <div className="bg-card rounded-xl border border-border p-5 mb-6 space-y-3">
                <h3 className="font-heading font-semibold text-foreground">Create New Session</h3>
                <input
                  value={newSession.name}
                  onChange={(e) => setNewSession((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Session name (e.g., RWAV Board Strategy 2026)"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                />
                <input
                  value={newSession.client_name}
                  onChange={(e) => setNewSession((p) => ({ ...p, client_name: e.target.value }))}
                  placeholder="Client name (e.g., RWAV)"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                />
                <textarea
                  value={newSession.description}
                  onChange={(e) => setNewSession((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Session description"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={createSession}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
                  >
                    Create Session
                  </button>
                  <button
                    onClick={() => setShowNewSession(false)}
                    className="px-4 py-2 border border-border text-foreground rounded-lg text-sm hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {sessions.length === 0 ? (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No workshop sessions yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((s) => (
                  <div key={s.id} className="bg-card rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-heading font-semibold text-foreground">{s.name}</h3>
                        <p className="text-sm text-muted-foreground">{s.client_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created: {new Date(s.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          s.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : s.status === 'archived'
                              ? 'bg-gray-100 text-gray-800'
                              : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      <Link
                        href={`/briefing/${s.id}`}
                        className="text-xs px-3 py-1.5 bg-muted text-foreground rounded hover:bg-muted/80 no-underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> Briefing
                      </Link>
                      <Link
                        href={`/pre-meeting/${s.id}`}
                        className="text-xs px-3 py-1.5 bg-muted text-foreground rounded hover:bg-muted/80 no-underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Pre-Meeting
                      </Link>
                      <Link
                        href={`/workshop/${s.id}`}
                        className="text-xs px-3 py-1.5 bg-primary/10 text-primary rounded hover:bg-primary/20 no-underline flex items-center gap-1"
                      >
                        <Users className="w-3 h-3" /> Workshop
                      </Link>
                      {s.status === 'draft' && (
                        <button
                          onClick={() => updateSessionStatus(s.id, 'active')}
                          className="text-xs px-3 py-1.5 bg-green-100 text-green-800 rounded hover:bg-green-200"
                        >
                          Activate
                        </button>
                      )}
                      {s.status === 'active' && (
                        <button
                          onClick={() => updateSessionStatus(s.id, 'archived')}
                          className="text-xs px-3 py-1.5 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 flex items-center gap-1"
                        >
                          <Archive className="w-3 h-3" /> Archive
                        </button>
                      )}
                      <button
                        onClick={() => deleteSession(s.id)}
                        className="text-xs px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Configuration Tab */}
        {activeTab === 'config' && (
          <div className="max-w-2xl">
            <h2 className="font-heading text-xl font-bold text-foreground mb-6">
              Application Configuration
            </h2>
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Application Title
                </label>
                <input
                  value={config.app_title}
                  onChange={(e) => setConfig((p) => ({ ...p, app_title: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Facilitator Name
                </label>
                <input
                  value={config.facilitator_name}
                  onChange={(e) => setConfig((p) => ({ ...p, facilitator_name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used in notification copy (e.g., "Carla has started a new session")
                </p>
              </div>
              <button
                onClick={() => toast.success('Configuration saved')}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
              >
                Save Configuration
              </button>
            </div>
          </div>
        )}

        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <div className="max-w-2xl">
            <h2 className="font-heading text-xl font-bold text-foreground mb-6">
              Branding & Theming
            </h2>
            <div className="bg-card rounded-xl border border-border p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Primary Colour
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.primary_colour}
                      onChange={(e) => setConfig((p) => ({ ...p, primary_colour: e.target.value }))}
                      className="w-10 h-10 rounded border border-input cursor-pointer"
                    />
                    <input
                      value={config.primary_colour}
                      onChange={(e) => setConfig((p) => ({ ...p, primary_colour: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Accent Colour
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={config.accent_colour}
                      onChange={(e) => setConfig((p) => ({ ...p, accent_colour: e.target.value }))}
                      className="w-10 h-10 rounded border border-input cursor-pointer"
                    />
                    <input
                      value={config.accent_colour}
                      onChange={(e) => setConfig((p) => ({ ...p, accent_colour: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm"
                    />
                  </div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                These colours will be applied across the toolkit for the selected client. Changes
                affect the Intelligence Briefing, Pre-Meeting tool, and Workshop interface.
              </p>
              <button
                onClick={() => toast.success('Branding saved')}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
              >
                Save Branding
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
