import { useEffect, useState } from 'react';
import { ArrowLeft, Download, CheckCircle2, TrendingUp, Target, Loader2 } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { getSessionReport } from '../api/interviews';

interface Answer {
  question_id: string; answer_text: string;
  scores: { relevance: number; clarity: number; depth: number; confidence: number; structure: number; };
  feedback: { strength?: string; gap?: string; sample_answer?: string; };
}

interface Report {
  session_id: string; overall_score: number; status: string;
  feedback_summary: { top_strength?: string; top_gap?: string; total_answers?: number; };
  answers: Answer[];
}

export default function FeedbackReport() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    getSessionReport(sessionId)
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
        <p className="text-gray-500 font-medium">Loading your report...</p>
      </div>
    </div>
  );

  if (!report) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500">Report not found.</p>
    </div>
  );

  const avgScores = report.answers.reduce((acc, a) => {
    if (!a.scores) return acc;
    Object.entries(a.scores).forEach(([k, v]) => {
      acc[k] = (acc[k] || 0) + (v || 0);
    });
    return acc;
  }, {} as Record<string, number>);
  const count = report.answers.length || 1;
  Object.keys(avgScores).forEach(k => { avgScores[k] = Math.round((avgScores[k] / count) * 10) / 10; });

  const overall = report.overall_score || 0;
  const perfLabel = overall >= 85 ? 'Excellent Performance' : overall >= 70 ? 'Strong Performance' : overall >= 55 ? 'Good Performance' : 'Needs Improvement';
  const perfColor = overall >= 85 ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : overall >= 70 ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-amber-100 text-amber-700 border-amber-200';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-20 border-b border-gray-200 flex items-center justify-between px-8 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              Session Feedback Report
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-full">Completed</span>
            </h1>
            <p className="text-sm text-gray-500">AI-powered performance analysis</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-6 py-2 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-all font-medium border border-gray-300 shadow-sm">
          <Download className="w-4 h-4" /> Share Report
        </button>
      </header>

      <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto w-full">
        {/* Left */}
        <div className="col-span-1 flex flex-col gap-6">
          <div className="p-8 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col items-center text-center">
            <span className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-2">Overall Score</span>
            <h2 className="text-6xl font-bold text-gray-900 flex items-baseline gap-1">
              {overall.toFixed(0)} <span className="text-2xl text-gray-400">/100</span>
            </h2>
            <div className={`mt-4 px-4 py-2 rounded-full text-sm font-bold border ${perfColor}`}>{perfLabel}</div>
            <div className="text-xs text-gray-400 mt-3">{report.answers.length} questions answered</div>
          </div>

          {/* Dimension scores */}
          <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm flex flex-col gap-5">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">Avg. per Dimension</h3>
            {Object.entries(avgScores).map(([dim, val]) => (
              <div key={dim} className="flex flex-col gap-1.5">
                <div className="flex justify-between text-sm font-bold text-gray-900">
                  <span className="capitalize">{dim}</span><span>{val}/10</span>
                </div>
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${val >= 8 ? 'bg-emerald-500' : val >= 6 ? 'bg-primary' : 'bg-amber-500'}`}
                    style={{ width: `${(val / 10) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="col-span-2 flex flex-col gap-6">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-6">
            <div className="p-6 rounded-2xl bg-emerald-50 border border-emerald-100">
              <h3 className="text-lg font-bold text-emerald-700 flex items-center gap-2 mb-3">
                <TrendingUp className="w-5 h-5" /> Top Strength
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed">{report.feedback_summary?.top_strength || 'Solid overall performance across multiple dimensions.'}</p>
            </div>
            <div className="p-6 rounded-2xl bg-amber-50 border border-amber-100">
              <h3 className="text-lg font-bold text-amber-700 flex items-center gap-2 mb-3">
                <Target className="w-5 h-5" /> Area to Improve
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed">{report.feedback_summary?.top_gap || 'Practice using the STAR framework for more structured responses.'}</p>
            </div>
          </div>

          {/* Per-answer breakdown */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-bold text-gray-900">Question Breakdown</h3>
            {report.answers.map((a, i) => {
              const avgScore = a.scores ? Object.values(a.scores).reduce((s, v) => s + (v || 0), 0) / 5 : 0;
              return (
                <div key={i} className="p-6 rounded-2xl bg-white border border-gray-200 shadow-sm">
                  <div className="flex items-start justify-between gap-6 mb-4">
                    <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Question {i + 1}</h4>
                    <div className={`shrink-0 w-12 h-12 rounded-full border-2 flex items-center justify-center font-bold text-sm ${
                      avgScore >= 8 ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-amber-200 text-amber-700 bg-amber-50'}`}>
                      {avgScore.toFixed(1)}
                    </div>
                  </div>
                  {a.answer_text && (
                    <p className="text-sm text-gray-600 mb-4 leading-relaxed italic">"{a.answer_text.slice(0, 200)}{a.answer_text.length > 200 ? '...' : ''}"</p>
                  )}
                  {a.scores && (
                    <div className="grid grid-cols-5 gap-2 mb-4">
                      {Object.entries(a.scores).map(([dim, val]) => (
                        <div key={dim} className="text-center bg-gray-50 rounded-lg p-2">
                          <div className={`text-sm font-bold ${(val as number) >= 8 ? 'text-emerald-600' : (val as number) >= 6 ? 'text-primary' : 'text-amber-600'}`}>
                            {(val as number)?.toFixed(1)}
                          </div>
                          <div className="text-xs capitalize text-gray-400 mt-0.5">{dim}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {a.feedback?.strength && (
                    <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-600 flex gap-3">
                      <CheckCircle2 className={`w-5 h-5 shrink-0 ${avgScore >= 7 ? 'text-emerald-500' : 'text-amber-500'}`} />
                      <div>
                        <p><span className="font-bold text-gray-700">✓ </span>{a.feedback.strength}</p>
                        {a.feedback.gap && <p className="mt-1 text-gray-500">{a.feedback.gap}</p>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
