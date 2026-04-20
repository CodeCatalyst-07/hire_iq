import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Users, FileUser, Loader2, ChevronRight,
  BarChart2, Trophy, AlertCircle, CheckCircle2, Clock, Trash2, GitCompare,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listSessions, getInsights, deleteSession } from '../api/interviews';
import type { SessionListItem, SessionInsights } from '../api/interviews';
import { listJobs } from '../api/jobs';

interface Job { id: string; title: string; status: string; }

const DIMENSIONS = ['relevance', 'clarity', 'depth', 'confidence', 'structure'] as const;
type Dimension = typeof DIMENSIONS[number];

const DIM_LABEL: Record<Dimension, string> = {
  relevance: 'Relevance',
  clarity: 'Clarity',
  depth: 'Depth',
  confidence: 'Confidence',
  structure: 'Structure',
};

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 85 ? 'text-emerald-600' : score >= 70 ? 'text-primary' : 'text-amber-600';
  const bar = score >= 85 ? 'bg-emerald-500' : score >= 70 ? 'bg-primary' : 'bg-amber-500';
  return (
    <div className="flex flex-col gap-1 w-32">
      <div className="flex justify-between text-xs font-bold">
        <span className="text-gray-400 uppercase tracking-wider">Score</span>
        <span className={color}>{score.toFixed(0)}/100</span>
      </div>
      <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = status === 'completed'
    ? { label: 'Completed', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' }
    : { label: 'In Progress', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function InterviewsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('all');
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [insights, setInsights] = useState<SessionInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());

  // Load jobs on mount
  useEffect(() => {
    listJobs().then(setJobs).catch(() => {});
  }, []);

  // Reload sessions + insights when filter changes
  useEffect(() => {
    const jid = selectedJobId === 'all' ? undefined : selectedJobId;
    setLoading(true);
    setInsightsLoading(true);

    Promise.all([listSessions(jid), getInsights(jid)])
      .then(([s, i]) => { setSessions(s); setInsights(i); })
      .catch(() => {})
      .finally(() => { setLoading(false); setInsightsLoading(false); });
  }, [selectedJobId]);

  const handleDelete = async (sessionId: string, candidateName: string) => {
    if (!window.confirm(`Are you sure you want to delete ${candidateName}'s session? This cannot be undone.`)) return;
    try {
      await deleteSession(sessionId);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      setCompareIds(prev => { const n = new Set(prev); n.delete(sessionId); return n; });
    } catch {
      alert('Failed to delete session. Please try again.');
    }
  };

  const toggleCompare = (id: string) => {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < 3) { next.add(id); }
      return next;
    });
  };

  const handleCompare = () => {
    if (compareIds.size < 2) return;
    navigate(`/compare?ids=${Array.from(compareIds).join(',')}`);
  };

  const formatDate = (dt: string | null) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const initials = (name: string) => name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

  // Summary stat cards
  const summaryCards = [
    {
      icon: FileUser,
      label: 'Total Sessions',
      value: insightsLoading ? '—' : insights?.total_sessions ?? 0,
      sub: 'mock interviews run',
    },
    {
      icon: CheckCircle2,
      label: 'Completed',
      value: insightsLoading ? '—' : insights?.completed_sessions ?? 0,
      sub: 'sessions finished',
    },
    {
      icon: Trophy,
      label: 'Avg Overall Score',
      value: insightsLoading ? '—' : insights ? `${insights.avg_overall_score}` : 0,
      sub: 'out of 100',
    },
    {
      icon: AlertCircle,
      label: 'Weakest Dimension',
      value: insightsLoading ? '—' : insights ? DIM_LABEL[insights.weakest_dimension as Dimension] ?? insights.weakest_dimension : '—',
      sub: 'needs most practice',
      highlight: true,
    },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* ── Sidebar ──────────────────────────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col gap-8 sticky top-0 h-screen">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white tracking-tighter">HIQ</div>
          <span className="text-xl font-bold tracking-tight text-gray-900">HireIQ</span>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <Link to="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500 hover:bg-purple-50 hover:text-primary transition-all font-medium border-l-4 border-transparent">
            <Users className="w-5 h-5" /> Candidates
          </Link>
          <Link to="/jobs"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500 hover:bg-purple-50 hover:text-primary transition-all font-medium border-l-4 border-transparent">
            <Briefcase className="w-5 h-5" /> Jobs
          </Link>
          <Link to="/interviews"
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-purple-50 border-l-4 border-primary text-primary font-medium">
            <FileUser className="w-5 h-5" /> Interviews
          </Link>
        </nav>

        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500 truncate">{user?.full_name || user?.email}</p>
          <button onClick={logout} className="text-xs text-primary hover:underline mt-1">Sign out</button>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-20 border-b border-gray-200 flex items-center justify-between px-8 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Interview Sessions</h1>
            {!loading && (
              <span className="text-sm font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {sessions.some(s => s.status === 'completed') && (
              <button
                onClick={() => { setCompareMode(m => !m); setCompareIds(new Set()); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border transition-all ${
                  compareMode
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-primary hover:text-primary'
                }`}
              >
                <GitCompare className="w-4 h-4" />
                {compareMode ? 'Cancel Compare' : 'Compare'}
              </button>
            )}
            {/* Job filter */}
            <select
              value={selectedJobId}
              onChange={e => setSelectedJobId(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-gray-50 focus:outline-none focus:border-primary min-w-[200px]"
            >
              <option value="all">All Job Roles</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title}</option>
              ))}
            </select>
          </div>
        </header>

        <div className="p-8 flex flex-col gap-8">

          {/* ── Summary stat cards ─────────────────────────────────── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {summaryCards.map(({ icon: Icon, label, value, sub, highlight }, i) => (
              <motion.div key={label}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={`p-5 rounded-xl bg-white border shadow-sm flex flex-col gap-1 ${highlight && insights && insights.total_sessions > 0 ? 'border-amber-200' : 'border-gray-200'}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${highlight && insights && insights.total_sessions > 0 ? 'text-amber-500' : 'text-primary'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</span>
                </div>
                <span className={`text-3xl font-bold ${highlight && insights && insights.total_sessions > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                  {value}
                </span>
                <span className="text-xs text-gray-400">{sub}</span>
              </motion.div>
            ))}
          </div>

          {/* ── Two-column: insights + sessions ────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Left: Dimension performance panel */}
            <motion.div
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex flex-col gap-5 h-fit"
            >
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-gray-900">Performance Insights</h2>
              </div>
              <p className="text-xs text-gray-400 -mt-3">Avg scores per dimension (out of 10)</p>

              {insightsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : !insights || insights.total_sessions === 0 ? (
                <div className="text-center py-10">
                  <BarChart2 className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No data yet</p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {DIMENSIONS.map(dim => {
                    const val = insights.dimensions[dim];
                    const isWeakest = dim === insights.weakest_dimension;
                    const barColor = isWeakest ? 'bg-amber-500' : val >= 8 ? 'bg-emerald-500' : 'bg-primary';
                    const textColor = isWeakest ? 'text-amber-600' : val >= 8 ? 'text-emerald-600' : 'text-primary';
                    return (
                      <div key={dim} className={`flex flex-col gap-1.5 p-3 rounded-xl ${isWeakest ? 'bg-amber-50 border border-amber-100' : 'bg-gray-50'}`}>
                        <div className="flex justify-between items-center">
                          <span className={`text-sm font-bold ${isWeakest ? 'text-amber-700' : 'text-gray-700'}`}>
                            {DIM_LABEL[dim]}
                            {isWeakest && <span className="ml-2 text-xs font-bold text-amber-600">← Weakest</span>}
                          </span>
                          <span className={`text-sm font-bold ${textColor}`}>{val}/10</span>
                        </div>
                        <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(val / 10) * 100}%` }}
                            transition={{ duration: 0.6, delay: 0.2 }}
                            className={`h-full rounded-full ${barColor}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Right: Sessions list */}
            <div className="lg:col-span-2 flex flex-col gap-4">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" /> Session History
              </h2>

              {loading ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                </div>
              ) : sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 gap-4 bg-white rounded-2xl border border-gray-200 shadow-sm text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <FileUser className="w-10 h-10 text-gray-300" />
                  </div>
                  <p className="text-gray-500 font-medium text-lg">No interview sessions yet.</p>
                  <p className="text-gray-400 text-sm max-w-xs">
                    Sessions appear here after a candidate completes a mock interview.
                  </p>
                </div>
              ) : (
                <AnimatePresence>
                  {sessions.map((s, i) => (
                    <motion.div
                      key={s.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={compareMode && s.status === 'completed' ? () => toggleCompare(s.id) : undefined}
                      className={`bg-white rounded-2xl border shadow-sm transition-all p-5 flex items-center gap-5 group ${
                        compareMode && s.status === 'completed'
                          ? compareIds.has(s.id)
                            ? 'border-primary ring-2 ring-primary/20 cursor-pointer hover:shadow-md'
                            : compareIds.size >= 3
                              ? 'border-gray-200 opacity-50 cursor-not-allowed'
                              : 'border-gray-200 hover:border-primary/40 cursor-pointer hover:shadow-md'
                          : 'border-gray-200 hover:shadow-md hover:border-primary/30'
                      }`}
                    >
                      {/* Compare checkbox */}
                      {compareMode && s.status === 'completed' && (
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          compareIds.has(s.id) ? 'border-primary bg-primary' : 'border-gray-300'
                        }`}>
                          {compareIds.has(s.id) && <span className="text-white text-xs font-bold">✓</span>}
                        </div>
                      )}

                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                        {initials(s.candidate_name)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm group-hover:text-primary transition-colors truncate">
                          {s.candidate_name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-500 truncate">{s.job_title}</span>
                          <span className="text-gray-300 text-xs">·</span>
                          <span className="text-xs text-gray-400">{formatDate(s.started_at)}</span>
                        </div>
                      </div>

                      {/* Score bar */}
                      {s.status === 'completed' && (
                        <ScoreGauge score={s.overall_score} />
                      )}

                      {/* Status badge */}
                      <StatusBadge status={s.status} />

                      {/* View report / Resume button */}
                      {s.status === 'completed' ? (
                        <button
                          onClick={() => navigate(`/interview/feedback/${s.id}`)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 text-primary text-xs font-bold hover:bg-primary hover:text-white transition-colors shrink-0"
                        >
                          View Report <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/interview/session/${s.id}`)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 transition-colors shrink-0"
                        >
                          Resume <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {/* Delete button */}
                      <button
                        onClick={() => handleDelete(s.id, s.candidate_name)}
                        title="Delete session"
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Floating compare bar */}
      <AnimatePresence>
        {compareMode && compareIds.size >= 2 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-gray-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl"
          >
            <span className="text-sm font-bold">{compareIds.size} candidates selected</span>
            <button
              onClick={handleCompare}
              className="flex items-center gap-2 px-5 py-2 bg-primary rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              <GitCompare className="w-4 h-4" /> Compare Selected →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
