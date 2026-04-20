import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, TrendingUp, Target, Loader2, BarChart2 } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { compareSessions } from '../api/interviews';
import type { CompareSessionItem } from '../api/interviews';

const DIMENSIONS = ['relevance', 'clarity', 'depth', 'confidence', 'structure'] as const;
type Dim = typeof DIMENSIONS[number];

const DIM_LABEL: Record<Dim, string> = {
  relevance: 'Relevance',
  clarity: 'Clarity',
  depth: 'Depth',
  confidence: 'Confidence',
  structure: 'Structure',
};

function initials(name: string) {
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function ScoreBar({ value, max = 10, best }: { value: number; max?: number; best: boolean }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = best ? 'bg-emerald-500' : value >= 7 ? 'bg-primary' : 'bg-amber-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6 }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      <span className={`text-sm font-bold w-8 text-right ${best ? 'text-emerald-600' : 'text-gray-700'}`}>
        {value.toFixed(1)}
      </span>
      {best && <span className="text-emerald-500 text-xs">⭐</span>}
    </div>
  );
}

export default function ComparisonPage() {
  const [searchParams] = useSearchParams();
  const { user, logout } = useAuth();

  const [candidates, setCandidates] = useState<CompareSessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const idsParam = searchParams.get('ids') || '';
    const ids = idsParam.split(',').filter(Boolean);
    if (!ids.length) { setLoading(false); return; }
    compareSessions(ids)
      .then(setCandidates)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Find best score for each dimension across all candidates
  const bestDim = (dim: Dim) => {
    if (!candidates.length) return -1;
    const scores = candidates.map(c => c.dimensions[dim]);
    return scores.indexOf(Math.max(...scores));
  };

  const winnerIdx = candidates.length
    ? candidates.reduce((best, c, i) => c.overall_score > candidates[best].overall_score ? i : best, 0)
    : -1;

  const COLORS = ['bg-purple-100 text-primary', 'bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700'];

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
        <p className="text-gray-500 font-medium">Loading comparison...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="h-20 border-b border-gray-200 flex items-center justify-between px-8 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link to="/interviews"
            className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              Candidate Comparison
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 bg-purple-50 text-primary border border-primary/20 rounded-full flex items-center gap-1">
                <BarChart2 className="w-3 h-3" /> {candidates.length} candidates
              </span>
            </h1>
            <p className="text-sm text-gray-500">Side-by-side interview performance analysis</p>
          </div>
        </div>
        <div className="text-xs text-gray-400">
          Signed in as <span className="font-bold text-gray-600">{user?.full_name || user?.email}</span>
          <button onClick={logout} className="ml-3 text-primary hover:underline">Sign out</button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
        {candidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <BarChart2 className="w-16 h-16 text-gray-200" />
            <p className="text-gray-500 font-medium text-lg">No sessions to compare.</p>
            <Link to="/interviews" className="text-primary hover:underline text-sm font-bold">← Back to Interviews</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {/* Candidate header cards */}
            <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${candidates.length}, 1fr)` }}>
              <div /> {/* spacer */}
              {candidates.map((c, _) => (
                <motion.div key={c.session_id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className={`p-5 rounded-2xl border-2 flex flex-col items-center text-center gap-3 relative ${i === winnerIdx ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
                  {i === winnerIdx && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                      <Trophy className="w-3 h-3" /> Top Performer
                    </div>
                  )}
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg ${COLORS[i]}`}>
                    {initials(c.candidate_name)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{c.candidate_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{c.job_title}</p>
                  </div>
                  <div className={`text-3xl font-bold ${i === winnerIdx ? 'text-emerald-600' : 'text-gray-900'}`}>
                    {c.overall_score.toFixed(0)}
                    <span className="text-base font-medium text-gray-400">/100</span>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Dimension scores table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-primary" />
                <h2 className="font-bold text-gray-900">Dimension Breakdown</h2>
                <span className="text-xs text-gray-400 ml-1">⭐ = best in dimension</span>
              </div>

              {DIMENSIONS.map((dim, ri) => {
                const bestI = bestDim(dim);
                return (
                  <div key={dim}
                    className={`grid items-center px-6 py-4 ${ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                    style={{ gridTemplateColumns: `200px repeat(${candidates.length}, 1fr)` }}>
                    <span className="text-sm font-bold text-gray-700">{DIM_LABEL[dim]}</span>
                    {candidates.map((c, ci) => (
                      <div key={c.session_id}
                        className={`px-3 py-2 rounded-xl ${ci === bestI ? 'bg-emerald-50 border border-emerald-200' : ''}`}>
                        <ScoreBar value={c.dimensions[dim]} best={ci === bestI} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Strengths & weaknesses */}
            <div className="grid gap-4" style={{ gridTemplateColumns: `200px repeat(${candidates.length}, 1fr)` }}>
              <div className="flex flex-col gap-4 justify-center">
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <TrendingUp className="w-4 h-4 text-emerald-500" /> Top Strength
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-gray-700">
                  <Target className="w-4 h-4 text-amber-500" /> Area to Improve
                </div>
              </div>
              {candidates.map((c, _) => (
                <div key={c.session_id} className="flex flex-col gap-4">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {c.feedback_summary?.top_strength || 'Strong overall performance.'}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                    <p className="text-xs text-gray-600 leading-relaxed">
                      {c.feedback_summary?.top_gap || 'Continue practicing structured responses.'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
