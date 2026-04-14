import { useEffect, useState } from 'react';
import { ArrowLeft, Brain, Code2, Users, Target, Copy, Play, Loader2 } from 'lucide-react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getQuestionBank, startSession } from '../api/interviews';

const CATEGORY_ICONS: Record<string, any> = {
  technical: Code2, behavioral: Users, skill_gap: Target,
  culture_fit: Users, motivation: Brain,
};

interface Question {
  id: string; category: string; question: string; purpose: string;
  difficulty: string; expected_framework: string; follow_up_probes: string[];
}

export default function InterviewQuestions() {
  const { bankId } = useParams<{ bankId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const candidateId = searchParams.get('candidateId');
  const jobId = searchParams.get('jobId');

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [startingSession, setStartingSession] = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!bankId) return;
    getQuestionBank(bankId)
      .then(data => setQuestions(data.questions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [bankId]);

  const handleStartSession = async () => {
    if (!bankId || !candidateId || !jobId) return;
    setStartingSession(true);
    try {
      const session = await startSession(candidateId, jobId, bankId);
      navigate(`/interview/session/${session.id}?bankId=${bankId}`);
    } catch {} finally { setStartingSession(false); }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const categories = ['All', ...Array.from(new Set(questions.map(q => q.category)))];
  const filtered = activeCategory === 'All' ? questions : questions.filter(q => q.category === activeCategory);

  const grouped = filtered.reduce((acc, q) => {
    if (!acc[q.category]) acc[q.category] = [];
    acc[q.category].push(q);
    return acc;
  }, {} as Record<string, Question[]>);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
        <p className="text-gray-500 font-medium">Generating AI questions...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-20 border-b border-gray-200 flex items-center justify-between px-8 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              Generated Questions
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-1 bg-purple-50 text-primary border border-primary/20 rounded-full flex items-center gap-1">
                <Brain className="w-3 h-3" /> {questions.length} questions
              </span>
            </h1>
            <p className="text-sm text-gray-500">AI-generated, tailored to this candidate's profile</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={() => handleCopy(questions.map(q => q.question).join('\n\n'), 'all')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium">
            <Copy className="w-4 h-4" /> {copied === 'all' ? 'Copied!' : 'Copy All'}
          </button>
          {candidateId && jobId && (
            <button onClick={handleStartSession} disabled={startingSession}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 transition-all font-medium disabled:opacity-60">
              {startingSession ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-white" />}
              Start Mock Interview
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        {/* Category filter */}
        <div className="flex items-center gap-2 mb-8 bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm w-max flex-wrap">
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all capitalize ${activeCategory === cat ? 'bg-primary text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}>
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        {questions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
            <Brain className="w-16 h-16 text-gray-200" />
            <p className="text-gray-500 font-medium">No questions generated yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {Object.entries(grouped).map(([category, qs]) => {
              const Icon = CATEGORY_ICONS[category] || Brain;
              return (
                <div key={category}>
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4 capitalize">
                    <Icon className="w-5 h-5 text-primary" /> {category.replace('_', ' ')}
                  </h3>
                  <div className="flex flex-col gap-4">
                    {qs.map((q) => (
                      <div key={q.id} className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm hover:border-primary/40 transition-colors">
                        <div className="flex items-start justify-between gap-8">
                          <div className="flex flex-col gap-3">
                            <p className="text-lg font-medium text-gray-900 leading-relaxed">"{q.question}"</p>
                            <div className="flex flex-wrap gap-2">
                              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-md border border-gray-200">
                                <Target className="w-4 h-4 text-primary" />
                                <span className="font-semibold text-gray-700">Purpose:</span> {q.purpose}
                              </div>
                              <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase border ${q.difficulty === 'hard' ? 'bg-red-50 text-red-600 border-red-200' : q.difficulty === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                                {q.difficulty}
                              </span>
                            </div>
                            {q.follow_up_probes?.length > 0 && (
                              <div className="mt-1">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Follow-ups</p>
                                <ul className="space-y-1">
                                  {q.follow_up_probes.map((fp, i) => (
                                    <li key={i} className="text-sm text-gray-500 flex items-start gap-2">
                                      <span className="text-primary mt-0.5">↳</span> {fp}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          <button onClick={() => handleCopy(q.question, q.id)}
                            className="p-2 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100 transition-colors shrink-0">
                            <Copy className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
