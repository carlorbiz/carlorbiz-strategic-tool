import { useEffect, useState, useRef } from 'react';
import { Link } from 'wouter';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import {
  ArrowLeft, Download, ChevronRight, BookOpen, Target,
  BarChart3, MapPin, DollarSign, Calendar,
} from 'lucide-react';
import type { StrategicPlanData } from '@shared/types';

const CHART_COLOURS = ['#2D7E32', '#D5B13A', '#2E4A3A', '#BFC3CD', '#C4D5EF', '#6E809C'];

const tabs = [
  { id: 'executive', label: 'Executive Summary', icon: BookOpen },
  { id: 'pillars', label: 'Three Pillars', icon: Target },
  { id: 'evidence', label: 'Evidence Base', icon: BarChart3 },
  { id: 'communities', label: 'Pilot Communities', icon: MapPin },
  { id: 'financial', label: 'Financial Strategy', icon: DollarSign },
  { id: 'timeline', label: 'Implementation', icon: Calendar },
];

export default function Briefing() {
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('executive');
  const [loading, setLoading] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/data/rwav-strategic-data.json')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleExportPDF = async () => {
    // Dynamic import to keep bundle lean
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(45, 126, 50);
    doc.text(data?.organisation?.name || 'Strategic Plan', 20, 30);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(46, 74, 58);
    doc.text('Strategic Plan 2026–2030', 20, 40);

    let y = 55;
    const addSection = (title: string, content: string) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(45, 126, 50);
      doc.text(title, 20, y);
      y += 8;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(46, 74, 58);
      const lines = doc.splitTextToSize(content, 170);
      doc.text(lines, 20, y);
      y += lines.length * 5 + 10;
    };

    addSection('Executive Summary', data?.executive_summary?.overview || '');

    if (data?.three_pillars) {
      data.three_pillars.forEach((p: any) => {
        addSection(`Pillar: ${p.name}`, p.description || '');
      });
    }

    addSection('Financial Strategy', data?.financial_strategy?.overview || '');

    doc.save('Strategic-Plan-Briefing.pdf');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Unable to load strategic plan data.</p>
      </div>
    );
  }

  // Prepare chart data from the RWAV JSON
  const surveyData = data.evidence_base?.community_pulse_survey?.willingness_to_change;
  const barData = surveyData
    ? Object.entries(surveyData).map(([key, val]) => ({
        name: key.replace(/_/g, ' '),
        value: val as number,
      }))
    : [];

  const pillarData = (data.three_pillars || []).map((p: any, i: number) => ({
    name: p.name?.split(':')[0] || `Pillar ${i + 1}`,
    objectives: p.objectives?.length || 0,
    kpis: p.objectives?.reduce((acc: number, o: any) => acc + (o.kpis?.length || 0), 0) || 0,
  }));

  const budgetData = (data.financial_strategy?.budget_items || []).map((b: any) => ({
    name: b.category,
    value: b.amount || b.percentage || 0,
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors no-underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Home
            </Link>
            <span className="text-border">/</span>
            <h1 className="font-heading font-semibold text-foreground">Intelligence Briefing</h1>
          </div>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </header>

      <div className="container py-6">
        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <nav className="hidden lg:block w-56 shrink-0">
            <div className="sticky top-20 space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                    activeTab === tab.id
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <tab.icon className="w-4 h-4 shrink-0" />
                  {tab.label}
                </button>
              ))}
            </div>
          </nav>

          {/* Mobile Tab Bar */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 px-2 py-1">
            <div className="flex overflow-x-auto gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div ref={contentRef} className="flex-1 min-w-0 pb-20 lg:pb-0">
            {/* Executive Summary */}
            {activeTab === 'executive' && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6 cb-card-accent-top">
                  <h2 className="font-heading text-2xl font-bold text-foreground mb-4">
                    {data.executive_summary?.title || 'Executive Summary'}
                  </h2>
                  <p className="text-foreground leading-relaxed">
                    {data.executive_summary?.overview}
                  </p>
                </div>

                {data.executive_summary?.key_findings && (
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
                      Key Findings
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {data.executive_summary.key_findings.map((finding: string, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <ChevronRight className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                          <p className="text-sm text-foreground">{finding}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.executive_summary?.strategic_direction && (
                  <div className="bg-primary/5 rounded-xl border border-primary/20 p-6">
                    <h3 className="font-heading text-lg font-semibold text-primary mb-2">
                      Strategic Direction
                    </h3>
                    <p className="text-foreground">{data.executive_summary.strategic_direction}</p>
                  </div>
                )}
              </div>
            )}

            {/* Three Pillars */}
            {activeTab === 'pillars' && (
              <div className="space-y-6">
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  Strategic Pillars
                </h2>

                {pillarData.length > 0 && (
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
                      Pillar Overview
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <RadarChart data={pillarData}>
                        <PolarGrid />
                        <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <PolarRadiusAxis />
                        <Radar
                          name="Objectives"
                          dataKey="objectives"
                          stroke="#2D7E32"
                          fill="#2D7E32"
                          fillOpacity={0.3}
                        />
                        <Radar
                          name="KPIs"
                          dataKey="kpis"
                          stroke="#D5B13A"
                          fill="#D5B13A"
                          fillOpacity={0.2}
                        />
                        <Legend />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {(data.three_pillars || []).map((pillar: any, i: number) => (
                  <div
                    key={i}
                    className="bg-card rounded-xl border border-border p-6 cb-card-accent-top"
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: CHART_COLOURS[i % CHART_COLOURS.length] }}
                      >
                        {i + 1}
                      </div>
                      <h3 className="font-heading text-lg font-semibold text-foreground">
                        {pillar.name}
                      </h3>
                    </div>
                    <p className="text-muted-foreground mb-4">{pillar.description}</p>
                    {pillar.objectives && (
                      <div className="space-y-3">
                        {pillar.objectives.map((obj: any, j: number) => (
                          <div key={j} className="pl-4 border-l-2 border-primary/30">
                            <h4 className="font-medium text-foreground text-sm">{obj.title}</h4>
                            <p className="text-xs text-muted-foreground mt-1">{obj.description}</p>
                            {obj.kpis && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {obj.kpis.map((kpi: string, k: number) => (
                                  <span
                                    key={k}
                                    className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground"
                                  >
                                    {kpi}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Evidence Base */}
            {activeTab === 'evidence' && (
              <div className="space-y-6">
                <h2 className="font-heading text-2xl font-bold text-foreground">Evidence Base</h2>

                {barData.length > 0 && (
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
                      Community Pulse Survey — Willingness to Change
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#2D7E32" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {data.evidence_base?.stakeholder_quotes && (
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
                      Stakeholder Voices
                    </h3>
                    <div className="space-y-4">
                      {data.evidence_base.stakeholder_quotes.map((q: any, i: number) => (
                        <blockquote
                          key={i}
                          className="border-l-4 border-[var(--cb-gold)] pl-4 py-2"
                        >
                          <p className="text-foreground italic">&ldquo;{q.quote}&rdquo;</p>
                          <cite className="text-sm text-muted-foreground mt-1 block not-italic">
                            — {q.attribution}
                          </cite>
                        </blockquote>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pilot Communities */}
            {activeTab === 'communities' && (
              <div className="space-y-6">
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  Pilot Communities
                </h2>

                {/* Placeholder for Victoria Map */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
                    Victoria Regional Map
                  </h3>
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">
                        Interactive Victoria map — connect Supabase to enable
                      </p>
                    </div>
                  </div>
                </div>

                {data.pilot_communities && (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {(Array.isArray(data.pilot_communities)
                      ? data.pilot_communities
                      : data.pilot_communities.communities || []
                    ).map((community: any, i: number) => (
                      <div key={i} className="bg-card rounded-xl border border-border p-5">
                        <h4 className="font-heading font-semibold text-foreground mb-1">
                          {community.name}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-2">
                          {community.region || community.description}
                        </p>
                        {community.population && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                            Pop. {community.population.toLocaleString()}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Financial Strategy */}
            {activeTab === 'financial' && (
              <div className="space-y-6">
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  Financial Strategy
                </h2>

                <div className="bg-card rounded-xl border border-border p-6">
                  <p className="text-foreground leading-relaxed">
                    {data.financial_strategy?.overview}
                  </p>
                </div>

                {budgetData.length > 0 && (
                  <div className="bg-card rounded-xl border border-border p-6">
                    <h3 className="font-heading text-lg font-semibold text-foreground mb-4">
                      Budget Allocation
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={budgetData}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name} (${(percent * 100).toFixed(0)}%)`
                          }
                        >
                          {budgetData.map((_: any, i: number) => (
                            <Cell
                              key={i}
                              fill={CHART_COLOURS[i % CHART_COLOURS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* Implementation Timeline */}
            {activeTab === 'timeline' && (
              <div className="space-y-6">
                <h2 className="font-heading text-2xl font-bold text-foreground">
                  Implementation Timeline
                </h2>

                {(data.implementation_timeline?.phases || data.implementation_timeline?.years || []).map(
                  (phase: any, i: number) => (
                    <div key={i} className="relative pl-8">
                      {/* Timeline line */}
                      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border" />
                      <div className="absolute left-1.5 top-2 w-4 h-4 rounded-full bg-primary border-2 border-background" />

                      <div className="bg-card rounded-xl border border-border p-5 mb-4">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-heading font-semibold text-foreground">
                            {phase.name || phase.year || `Phase ${i + 1}`}
                          </h3>
                          {(phase.start || phase.period) && (
                            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                              {phase.start && phase.end
                                ? `${phase.start} — ${phase.end}`
                                : phase.period}
                            </span>
                          )}
                        </div>
                        {phase.focus && (
                          <p className="text-sm text-muted-foreground mb-2">{phase.focus}</p>
                        )}
                        {(phase.milestones || phase.activities) && (
                          <ul className="space-y-1">
                            {(phase.milestones || phase.activities).map(
                              (m: string, j: number) => (
                                <li
                                  key={j}
                                  className="flex items-start gap-2 text-sm text-foreground"
                                >
                                  <ChevronRight className="w-3 h-3 text-primary mt-1 shrink-0" />
                                  {typeof m === 'string' ? m : (m as any).description || (m as any).title}
                                </li>
                              ),
                            )}
                          </ul>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
