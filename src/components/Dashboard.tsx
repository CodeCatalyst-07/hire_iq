import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, FileUser, Briefcase, Plus, Search, Filter, ChevronRight, X, Loader2, UploadCloud } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listJobs, createJob, getJobStats } from '../api/jobs';
import { uploadResume, listCandidates } from '../api/candidates';

interface Job { id: string; title: string; status: string; }
interface Candidate {
  id: string; total_score: number; skill_match_pct: number; status: string; parse_status: string;
  candidate: { name: string; email: string | null; };
}
interface Stats { total_applicants: number; shortlisted: number; avg_match_score: number; pending: number; shortlist_rate: number; }

export default function Dashboard() {
  const { user, logout } = useAuth();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Modals
  const [showJobModal, setShowJobModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [jobForm, setJobForm] = useState({ title: '', description: '', required_skills: '', nice_to_have_skills: '' });
  const [jobLoading, setJobLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  // Load jobs on mount
  useEffect(() => {
    listJobs().then((data) => {
      setJobs(data);
      if (data.length > 0) setSelectedJob(data[0]);
    }).catch(() => {});
  }, []);

  // Reload candidates AND stats whenever selected job changes
  useEffect(() => {
    if (!selectedJob) {
      setCandidates([]);
      setStats(null);
      return;
    }
    setLoading(true);
    Promise.all([
      listCandidates(selectedJob.id),
      getJobStats(selectedJob.id),
    ]).then(([candidateData, statsData]) => {
      setCandidates(candidateData.items || []);
      setStats(statsData);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [selectedJob]);

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setJobLoading(true);
    try {
      const job = await createJob({
        title: jobForm.title,
        description: jobForm.description,
        required_skills: jobForm.required_skills.split(',').map(s => s.trim()).filter(Boolean),
        nice_to_have_skills: jobForm.nice_to_have_skills.split(',').map(s => s.trim()).filter(Boolean),
      });
      setJobs(prev => [job, ...prev]);
      setSelectedJob(job);
      setShowJobModal(false);
      setJobForm({ title: '', description: '', required_skills: '', nice_to_have_skills: '' });
    } catch { } finally { setJobLoading(false); }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !selectedJob) return;
    setUploadLoading(true);
    setUploadMsg('');
    try {
      await uploadResume(uploadFile, selectedJob.id);
      setUploadMsg('✓ Resume parsed and scored successfully!');
      // Refresh candidates
      const data = await listCandidates(selectedJob.id);
      setCandidates(data.items || []);
      setUploadFile(null);
      setTimeout(() => { setShowUploadModal(false); setUploadMsg(''); }, 1500);
    } catch (err: any) {
      setUploadMsg('Upload failed: ' + (err?.response?.data?.detail || 'Unknown error'));
    } finally { setUploadLoading(false); }
  };

  const filtered = candidates.filter(c =>
    c.candidate.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col gap-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-white tracking-tighter">HIQ</div>
          <span className="text-xl font-bold tracking-tight text-gray-900">HireIQ</span>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          <Link to="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-purple-50 border-l-4 border-primary text-primary font-medium">
            <Users className="w-5 h-5" /> Candidates
          </Link>
          <Link to="/jobs" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500 hover:bg-purple-50 hover:text-primary transition-all font-medium border-l-4 border-transparent">
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

      {/* Main */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-20 border-b border-gray-200 flex items-center justify-between px-8 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Active Candidates</h1>
            {/* Job selector */}
            {jobs.length > 0 && (
              <select
                value={selectedJob?.id || ''}
                onChange={e => setSelectedJob(jobs.find(j => j.id === e.target.value) || null)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 bg-gray-50 focus:outline-none focus:border-primary"
              >
                {jobs.map(j => <option key={j.id} value={j.id}>{j.title}</option>)}
              </select>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search candidates..." value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-full pl-10 pr-4 py-2 text-sm text-gray-900 focus:outline-none focus:border-primary transition-colors w-56 placeholder:text-gray-400"
              />
            </div>
            <button onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors">
              <UploadCloud className="w-4 h-4" /> Upload Resume
            </button>
            <button onClick={() => setShowJobModal(true)}
              className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-sm hover:bg-primary/90 transition-colors">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="p-8">
          {/* Stats */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Total Resumes', value: stats?.total_applicants ?? '—', color: 'text-gray-900' },
              { label: 'Shortlisted', value: stats?.shortlisted ?? '—', color: 'text-gray-900' },
              { label: 'Avg Match Score', value: stats ? `${stats.avg_match_score}%` : '—', color: 'text-gray-900' },
              { label: 'Pending Review', value: stats?.pending ?? '—', color: 'text-amber-600' },
            ].map((kpi, i) => (
              <div key={i} className="p-6 rounded-xl bg-white border border-gray-200 shadow-sm flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-500 tracking-wide uppercase">{kpi.label}</span>
                <span className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</span>
              </div>
            ))}
          </div>

          {/* Candidate list */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-white">
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                <Filter className="w-4 h-4" /> Filter
              </button>
              <span className="text-sm font-bold text-gray-700 px-3 py-1 bg-gray-100 rounded-full border border-gray-200">
                {filtered.length} Candidates
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center p-16 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-16 text-center gap-4">
                <UploadCloud className="w-12 h-12 text-gray-300" />
                <p className="text-gray-500 font-medium">
                  {jobs.length === 0 ? 'Create a job first, then upload resumes.' : 'No candidates yet. Upload a resume to get started.'}
                </p>
                {jobs.length === 0 && (
                  <button onClick={() => setShowJobModal(true)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90">
                    + Create Job
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col">
                {filtered.map((c, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }} key={c.id}
                    className="flex items-center justify-between p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-700">
                        {c.candidate.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 group-hover:text-primary transition-colors">{c.candidate.name}</h4>
                        <p className="text-sm text-gray-500">{c.candidate.email || 'No email'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-12">
                      <div className="flex flex-col items-end gap-1 w-32">
                        <div className="flex justify-between w-full text-xs font-bold uppercase tracking-wider">
                          <span className="text-gray-500">Match</span>
                          <span className={c.total_score > 90 ? "text-emerald-600" : c.total_score > 75 ? "text-primary" : "text-amber-600"}>
                            {Math.round(c.total_score)}%
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${c.total_score > 90 ? "bg-emerald-500" : c.total_score > 75 ? "bg-primary" : "bg-amber-500"}`}
                            style={{ width: `${c.total_score}%` }} />
                        </div>
                      </div>
                      <div className="w-24 text-right">
                        <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full ${
                          c.status === 'shortlisted' ? 'bg-emerald-100 text-emerald-800' :
                          c.status === 'reviewing' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-700'}`}>
                          {c.status}
                        </span>
                      </div>
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
      </main>

      {/* Create Job Modal */}
      <AnimatePresence>
        {showJobModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Create Job Posting</h2>
                <button onClick={() => setShowJobModal(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleCreateJob} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Job Title *</label>
                  <input required value={jobForm.title} onChange={e => setJobForm({ ...jobForm, title: e.target.value })}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Description</label>
                  <textarea value={jobForm.description} onChange={e => setJobForm({ ...jobForm, description: e.target.value })}
                    rows={3} placeholder="Describe the role..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Required Skills (comma-separated)</label>
                  <input value={jobForm.required_skills} onChange={e => setJobForm({ ...jobForm, required_skills: e.target.value })}
                    placeholder="React, TypeScript, Node.js"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Nice-to-Have Skills (comma-separated)</label>
                  <input value={jobForm.nice_to_have_skills} onChange={e => setJobForm({ ...jobForm, nice_to_have_skills: e.target.value })}
                    placeholder="GraphQL, AWS, Docker"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowJobModal(false)}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
                  <button type="submit" disabled={jobLoading}
                    className="flex-1 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                    {jobLoading && <Loader2 className="w-4 h-4 animate-spin" />} Create Job
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Resume Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Upload Resume</h2>
                <button onClick={() => { setShowUploadModal(false); setUploadMsg(''); setUploadFile(null); }} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
              </div>
              {!selectedJob ? (
                <p className="text-gray-500 text-center py-8">Please create or select a job first.</p>
              ) : (
                <form onSubmit={handleUpload} className="space-y-5">
                  <p className="text-sm text-gray-600">Uploading for: <span className="font-bold text-primary">{selectedJob.title}</span></p>
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
                  <button type="submit" disabled={!uploadFile || uploadLoading}
                    className="w-full py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2">
                    {uploadLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing Resume...</> : 'Upload & Parse'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
