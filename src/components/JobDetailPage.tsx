import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase, Users, FileUser, ArrowLeft, Loader2, ChevronRight,
  UploadCloud, Brain, Target, TrendingUp, UserCheck,
} from 'lucide-react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getJob, getJobStats, updateJob } from '../api/jobs';
import { listCandidates, uploadResume } from '../api/candidates';

interface Job {
  id: string; title: string; description: string | null;
  required_skills: string[]; nice_to_have_skills: string[]; status: string; created_at: string;
}
interface Stats {
  total_applicants: number; avg_match_score: number;
  shortlisted: number; pending: number; rejected: number; shortlist_rate: number;
}
interface Candidate {
  id: string; total_score: number; skill_match_pct: number; status: string;
  candidate: { name: string; email: string | null };
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  active: { label: 'Open',   bg: 'bg-emerald-50', text: 'text-emerald-700' },
  closed: { label: 'Closed', bg: 'bg-red-50',     text: 'text-red-700' },
  draft:  { label: 'Draft',  bg: 'bg-amber-50',   text: 'text-amber-700' },
};

export default function JobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [job, setJob] = useState<Job | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  const [changingStatus, setChangingStatus] = useState(false);

  // Upload modal
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  useEffect(() => {
    if (!jobId) return;
    Promise.all([getJob(jobId), getJobStats(jobId)])
      .then(([j, s]) => { setJob(j); setStats(s); })
      .catch(() => {})
      .finally(() => setLoading(false));

    setCandidatesLoading(true);
    listCandidates(jobId)
      .then(data => setCandidates(data.items || []))
      .catch(() => {})
      .finally(() => setCandidatesLoading(false));
  }, [jobId]);

  const handleStatusChange = async (status: string) => {
    if (!jobId || !job) return;
    setChangingStatus(true);
    try {
      const updated = await updateJob(jobId, { status });
      setJob(prev => prev ? { ...prev, status: updated.status } : prev);
    } catch {} finally { setChangingStatus(false); }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !jobId) return;
    setUploading(true);
    setUploadMsg('');
    try {
      await uploadResume(uploadFile, jobId);
      setUploadMsg('✓ Resume parsed and scored!');
      const data = await listCandidates(jobId);
      setCandidates(data.items || []);
      // Refresh stats
      const s = await getJobStats(jobId);
      setStats(s);
      setUploadFile(null);
      setTimeout(() => { setShowUpload(false); setUploadMsg(''); }, 1500);
    } catch (err: any) {
      setUploadMsg('Upload failed: ' + (err?.response?.data?.detail || 'Unknown error'));
    } finally { setUploading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  );

  if (!job) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <p className="text-gray-500 font-medium mb-4">Job not found.</p>
        <Link to="/jobs" className="text-primary font-bold hover:underline">← Back to Jobs</Link>
      </div>
    </div>
  );

  const statusCfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.draft;

  const statCards = [
    { icon: Users,     label: 'Total Applicants',  value: stats?.total_applicants ?? '—', sub: 'resumes uploaded' },
    { icon: Target,    label: 'Avg Match Score',   value: stats ? `${stats.avg_match_score}%` : '—', sub: 'across all candidates' },
    { icon: UserCheck, label: 'Shortlisted',       value: stats?.shortlisted ?? '—', sub: 'candidates' },
    { icon: TrendingUp,label: 'Shortlist Rate',    value: stats ? `${stats.shortlist_rate}%` : '—', sub: 'of applicants' },
  ];

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col gap-8 sticky top-0 h-screen">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white tracking-tighter">HIQ</div>
          <span className="text-xl font-bold tracking-tight text-gray-900">HireIQ</span>
        </div>
        <nav className="flex flex-col gap-2 flex-1">
          <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500 hover:bg-purple-50 hover:text-primary transition-all font-medium border-l-4 border-transparent">
            <Users className="w-5 h-5" /> Candidates
          </Link>
          <Link to="/jobs" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-purple-50 border-l-4 border-primary text-primary font-medium">
            <Briefcase className="w-5 h-5" /> Jobs
          </Link>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500 hover:bg-purple-50 hover:text-primary transition-all font-medium border-l-4 border-transparent">
            <FileUser className="w-5 h-5" /> Interviews
          </a>
        </nav>
        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500 truncate">{user?.full_name || user?.email}</p>
          <button onClick={logout} className="text-xs text-primary hover:underline mt-1">Sign out</button>
        </div>
      </aside>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-20 border-b border-gray-200 flex items-center justify-between px-8 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Link to="/jobs"
              className="w-10 h-10 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                {job.title}
                <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
                  {statusCfg.label}
                </span>
              </h1>
              <p className="text-sm text-gray-400">
                Created {new Date(job.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Status toggle */}
            <select
              value={job.status}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={changingStatus}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-gray-50 focus:outline-none focus:border-primary disabled:opacity-60"
            >
              <option value="active">Open</option>
              <option value="closed">Closed</option>
              <option value="draft">Draft</option>
            </select>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <UploadCloud className="w-4 h-4" /> Upload Resume
            </button>
          </div>
        </header>

        <div className="p-8 flex flex-col gap-8">

          {/* Analytics row */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {statCards.map(({ icon: Icon, label, value, sub }, i) => (
              <motion.div key={label}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
                className="p-5 rounded-xl bg-white border border-gray-200 shadow-sm flex flex-col gap-1"
              >
                <div className="flex items-center gap-2 text-primary mb-1">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</span>
                </div>
                <span className="text-3xl font-bold text-gray-900">{value}</span>
                <span className="text-xs text-gray-400">{sub}</span>
              </motion.div>
            ))}
          </div>

          {/* Job details + candidates two-col layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left: job info */}
            <div className="flex flex-col gap-6">
              {/* Description */}
              {job.description && (
                <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Description</h3>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{job.description}</p>
                </div>
              )}
              {/* Required skills */}
              {job.required_skills.length > 0 && (
                <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Required Skills</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.required_skills.map(s => (
                      <span key={s} className="px-3 py-1 text-sm font-medium bg-purple-50 text-primary border border-primary/20 rounded-md">{s}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Nice to have */}
              {job.nice_to_have_skills.length > 0 && (
                <div className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Nice to Have</h3>
                  <div className="flex flex-wrap gap-2">
                    {job.nice_to_have_skills.map(s => (
                      <span key={s} className="px-3 py-1 text-sm font-medium bg-gray-50 text-gray-600 border border-gray-200 rounded-md">{s}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: candidate list */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="p-5 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" /> Candidates
                  </h3>
                  <span className="text-xs font-bold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full border border-gray-200">
                    {candidates.length}
                  </span>
                </div>

                {candidatesLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : candidates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <UploadCloud className="w-12 h-12 text-gray-200" />
                    <p className="text-gray-500 font-medium">No candidates yet.</p>
                    <button onClick={() => setShowUpload(true)}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90">
                      Upload a Resume
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col divide-y divide-gray-100">
                    {candidates.map((c, i) => (
                      <motion.div key={c.id}
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700 text-sm">
                            {c.candidate.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900 text-sm group-hover:text-primary transition-colors">
                              {c.candidate.name}
                            </p>
                            <p className="text-xs text-gray-400">{c.candidate.email || 'No email'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          {/* Score bar */}
                          <div className="flex flex-col items-end gap-1 w-28">
                            <div className="flex justify-between w-full text-xs font-bold uppercase tracking-wider">
                              <span className="text-gray-400">Match</span>
                              <span className={c.total_score > 85 ? 'text-emerald-600' : c.total_score > 70 ? 'text-primary' : 'text-amber-600'}>
                                {Math.round(c.total_score)}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${c.total_score > 85 ? 'bg-emerald-500' : c.total_score > 70 ? 'bg-primary' : 'bg-amber-500'}`}
                                style={{ width: `${c.total_score}%` }} />
                            </div>
                          </div>
                          {/* Status badge */}
                          <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                            c.status === 'shortlisted' ? 'bg-emerald-100 text-emerald-800' :
                            c.status === 'reviewing'   ? 'bg-blue-100 text-blue-800' :
                            c.status === 'rejected'    ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-700'}`}>
                            {c.status}
                          </span>
                          <Link to={`/candidate/${c.id}`}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors">
                            <ChevronRight className="w-5 h-5" />
                          </Link>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Upload Modal ───────────────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Upload Resume</h2>
              <button onClick={() => { setShowUpload(false); setUploadMsg(''); setUploadFile(null); }}
                className="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Uploading for: <span className="font-bold text-primary">{job.title}</span>
            </p>
            <form onSubmit={handleUpload} className="space-y-5">
              <label className="block w-full border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer group">
                <UploadCloud className="w-10 h-10 text-gray-300 group-hover:text-primary mx-auto mb-3 transition-colors" />
                <p className="text-sm font-medium text-gray-600">{uploadFile ? uploadFile.name : 'Click to upload PDF or DOCX'}</p>
                <p className="text-xs text-gray-400 mt-1">Max 10MB</p>
                <input type="file" accept=".pdf,.docx" className="hidden"
                  onChange={e => setUploadFile(e.target.files?.[0] || null)} />
              </label>
              {uploadMsg && (
                <p className={`text-sm px-4 py-3 rounded-lg border ${uploadMsg.startsWith('✓') ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {uploadMsg}
                </p>
              )}
              <button type="submit" disabled={!uploadFile || uploading}
                className="w-full py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing…</> : 'Upload & Parse'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
