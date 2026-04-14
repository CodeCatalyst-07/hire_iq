import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Brain, CheckCircle2, Download, Briefcase, Loader2, ChevronDown } from 'lucide-react';
import { getCandidate, updateCandidateStatus } from '../api/candidates';
import { generateQuestions } from '../api/interviews';

interface Profile {
  id: string; candidate_id: string; job_id: string;
  total_score: number; skill_match_pct: number; experience_years: number;
  education_level: string | null; status: string; parse_status: string;
  parsed_data: any; score_breakdown: any;
  candidate: { id: string; name: string; email: string | null; phone: string | null; location: string | null; linkedin_url: string | null; };
}

const STATUS_OPTIONS = ['pending', 'reviewing', 'shortlisted', 'rejected'];

export default function CandidateProfile() {
  const { id: profileId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [generatingQ, setGeneratingQ] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [showStatusDrop, setShowStatusDrop] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    getCandidate(profileId)
      .then(setProfile)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profileId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!profile) return;
    setStatusLoading(true);
    setShowStatusDrop(false);
    try {
      const updated = await updateCandidateStatus(profile.id, newStatus);
      setProfile(updated);
    } catch {} finally { setStatusLoading(false); }
  };

  const handleGenerateQuestions = async () => {
    if (!profile) return;
    setGeneratingQ(true);
    try {
      const bank = await generateQuestions(profile.id, profile.job_id);
      navigate(`/interview/questions/${bank.id}?candidateId=${profile.candidate_id}&jobId=${profile.job_id}`);
    } catch {} finally { setGeneratingQ(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-500">Candidate not found.</p>
    </div>
  );

  const parsed = profile.parsed_data || {};
  const skills = parsed.skills || {};
  const allSkills: string[] = [...(skills.hard_skills || []), ...(skills.tools || [])];
  const experience: any[] = parsed.experience || [];
  const scoreBreakdown = profile.score_breakdown || {};
  const statusColor = profile.status === 'shortlisted' ? 'bg-emerald-100 text-emerald-800' :
    profile.status === 'reviewing' ? 'bg-blue-100 text-blue-800' :
    profile.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="h-20 border-b border-gray-200 flex items-center justify-between px-8 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              {profile.candidate.name}
              {/* Status dropdown */}
              <div className="relative">
                <button onClick={() => setShowStatusDrop(!showStatusDrop)}
                  className={`text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1 cursor-pointer ${statusColor}`}>
                  {statusLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : profile.status}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showStatusDrop && (
                  <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden min-w-max">
                    {STATUS_OPTIONS.map(s => (
                      <button key={s} onClick={() => handleStatusChange(s)}
                        className="block w-full text-left px-4 py-2 text-sm font-medium capitalize hover:bg-gray-50 text-gray-700">
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </h1>
            <p className="text-sm text-gray-500">Resume Profile</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors font-medium">
            <Download className="w-4 h-4" /> Export
          </button>
          <button onClick={handleGenerateQuestions} disabled={generatingQ}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-white shadow-sm hover:bg-primary/90 transition-all font-medium disabled:opacity-60">
            {generatingQ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
            {generatingQ ? 'Generating...' : 'Generate Questions'}
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto w-full">
        {/* Left */}
        <div className="col-span-1 flex flex-col gap-6">
          <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gray-100 flex items-center justify-center text-3xl font-bold text-gray-700">
                  {profile.candidate.name.charAt(0)}
                </div>
                <div className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-xs font-bold ${profile.total_score > 85 ? 'bg-emerald-100 text-emerald-700' : profile.total_score > 70 ? 'bg-purple-100 text-primary' : 'bg-amber-100 text-amber-700'}`}>
                  {Math.round(profile.total_score)}%
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">{profile.candidate.name}</h2>
                <p className="text-gray-500 text-sm mt-1">{profile.candidate.email}</p>
                {profile.candidate.location && <p className="text-gray-400 text-xs mt-1">{profile.candidate.location}</p>}
              </div>
              <div className="w-full grid grid-cols-3 gap-2 mt-2">
                {[
                  { label: 'Experience', val: `${profile.experience_years} Yrs` },
                  { label: 'Education', val: profile.education_level?.split(' ')[0] || 'N/A' },
                  { label: 'Skill Match', val: `${Math.round(profile.skill_match_pct)}%` },
                ].map(s => (
                  <div key={s.label} className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex flex-col items-center gap-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{s.label}</span>
                    <span className="text-sm font-bold text-gray-900">{s.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Score Breakdown */}
          <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">Score Breakdown</h3>
            <div className="space-y-3">
              {Object.entries(scoreBreakdown).map(([key, val]) => (
                <div key={key}>
                  <div className="flex justify-between text-xs font-bold text-gray-700 mb-1">
                    <span className="capitalize">{key.replace('_', ' ')}</span>
                    <span>{Math.round(val as number)}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${val}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Analysis */}
          {parsed.ai_insights && (
            <div className="p-6 rounded-xl bg-[#FAFAFA] border border-gray-200 shadow-sm">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> AI Analysis
              </h3>
              <ul className="space-y-3">
                {parsed.ai_insights.map((ins: string, i: number) => (
                  <li key={i} className="flex gap-3 items-start">
                    <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <p className="text-sm text-gray-700 leading-relaxed">{ins}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="col-span-2 flex flex-col gap-6">
          {/* Skills */}
          <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-200 pb-4 mb-4">
              <Brain className="w-5 h-5 text-primary" /> Extracted Skills
            </h3>
            {allSkills.length === 0 ? (
              <p className="text-gray-400 text-sm">No skills extracted.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allSkills.map((s) => (
                  <span key={s} className="px-3 py-1.5 rounded-md text-sm font-medium border bg-white text-emerald-600 border-emerald-400">
                    ✓ {s}
                  </span>
                ))}
                {(skills.soft_skills || []).map((s: string) => (
                  <span key={s} className="px-3 py-1.5 rounded-md text-sm font-medium border bg-white text-gray-500 border-gray-300">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Experience */}
          <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2 border-b border-gray-200 pb-4 mb-6">
              <Briefcase className="w-5 h-5 text-primary" /> Experience
            </h3>
            {experience.length === 0 ? (
              <p className="text-gray-400 text-sm">No experience extracted.</p>
            ) : (
              <div className="space-y-6">
                {experience.map((exp, i) => (
                  <div key={i} className="p-5 rounded-xl border border-gray-100 bg-gray-50">
                    <div className="font-bold text-gray-900">{exp.title}</div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mt-1 mb-2">
                      <span className="font-medium text-primary">{exp.company}</span>
                      <span>·</span> <span>{exp.start_date} – {exp.end_date}</span>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{exp.description}</p>
                    {exp.technologies?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {exp.technologies.map((t: string) => (
                          <span key={t} className="text-xs px-2 py-0.5 bg-purple-50 text-primary rounded-md border border-primary/20">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
