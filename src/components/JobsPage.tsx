import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Users, FileUser, Plus, Search, X, Loader2,
  MoreVertical, ChevronRight, BarChart2, Clock,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listJobs, createJob, updateJob, deleteJob } from '../api/jobs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { JobCardSkeleton } from './Skeleton';

interface Job {
  id: string;
  title: string;
  description: string | null;
  required_skills: string[];
  nice_to_have_skills: string[];
  status: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  active: { label: 'Open',   bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  closed: { label: 'Closed', bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500' },
  draft:  { label: 'Draft',  bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function JobsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', required_skills: '', nice_to_have_skills: '',
  });
  const [createErr, setCreateErr] = useState('');

  // ── Opt 6: useQuery for job list ──────────────────────────────────────────
  const { data: jobs = [], isLoading: loading } = useQuery({
    queryKey: ['jobs'],
    queryFn: listJobs,
  });

  // Close context menu when clicking outside
  useEffect(() => {
    const handler = () => setOpenMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const createMutation = useMutation({
    mutationFn: createJob,
    onSuccess: (newJob) => {
      queryClient.setQueryData<Job[]>(['jobs'], prev => [newJob as Job, ...(prev ?? [])]);
      setShowModal(false);
      setForm({ title: '', description: '', required_skills: '', nice_to_have_skills: '' });
    },
    onError: (err: any) => {
      setCreateErr(err?.response?.data?.detail || 'Failed to create job. Please try again.');
    },
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreateErr('');
    createMutation.mutate({
      title: form.title,
      description: form.description || undefined,
      required_skills: form.required_skills.split(',').map(s => s.trim()).filter(Boolean),
      nice_to_have_skills: form.nice_to_have_skills.split(',').map(s => s.trim()).filter(Boolean),
    });
  };

  const handleStatusChange = async (jobId: string, status: string) => {
    setOpenMenu(null);
    try {
      const updated = await updateJob(jobId, { status });
      queryClient.setQueryData<Job[]>(['jobs'], prev =>
        (prev ?? []).map(j => j.id === jobId ? { ...j, status: updated.status } : j)
      );
    } catch {}
  };

  const handleDelete = async (jobId: string) => {
    setOpenMenu(null);
    if (!confirm('Archive this job? It will be hidden from the board.')) return;
    try {
      await deleteJob(jobId);
      queryClient.setQueryData<Job[]>(['jobs'], prev => (prev ?? []).filter(j => j.id !== jobId));
    } catch {}
  };

  const filtered = jobs.filter(j => {
    const matchSearch = j.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || j.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const inputClass = 'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-primary transition-colors text-sm';
  const labelClass = 'block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5';

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
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
            className="flex items-center gap-3 px-3 py-2 rounded-lg bg-purple-50 border-l-4 border-primary text-primary font-medium">
            <Briefcase className="w-5 h-5" /> Jobs
          </Link>
          <Link to="/interviews"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-500 hover:bg-purple-50 hover:text-primary transition-all font-medium border-l-4 border-transparent">
            <FileUser className="w-5 h-5" /> Interviews
          </Link>
        </nav>

        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-500 truncate">{user?.full_name || user?.email}</p>
          <button onClick={logout} className="text-xs text-primary hover:underline mt-1">Sign out</button>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-20 border-b border-gray-200 flex items-center justify-between px-8 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Job Postings</h1>
            <span className="text-sm font-bold text-gray-400 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
              {filtered.length} {filtered.length === 1 ? 'job' : 'jobs'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search jobs…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-gray-50 border border-gray-200 rounded-full pl-9 pr-4 py-2 text-sm text-gray-900 focus:outline-none focus:border-primary w-48 placeholder:text-gray-400"
              />
            </div>
            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-gray-50 focus:outline-none focus:border-primary"
            >
              <option value="all">All Statuses</option>
              <option value="active">Open</option>
              <option value="closed">Closed</option>
              <option value="draft">Draft</option>
            </select>
            {/* New Job */}
            <button
              onClick={() => setShowModal(true)}
              id="create-job-btn"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> New Job
            </button>
          </div>
        </header>

        <div className="p-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => <JobCardSkeleton key={i} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center">
                <Briefcase className="w-10 h-10 text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium text-lg">
                {search || filterStatus !== 'all' ? 'No jobs match your filters.' : 'No job postings yet.'}
              </p>
              {!search && filterStatus === 'all' && (
                <button
                  onClick={() => setShowModal(true)}
                  className="px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90"
                >
                  + Create your first job
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((job, i) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="relative bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary/30 transition-all group flex flex-col"
                >
                  {/* Card header */}
                  <div className="p-6 flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <StatusBadge status={job.status} />
                      {/* Context menu */}
                      <div className="relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setOpenMenu(openMenu === job.id ? null : job.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        <AnimatePresence>
                          {openMenu === job.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[160px] overflow-hidden"
                            >
                              {job.status !== 'active' && (
                                <button onClick={() => handleStatusChange(job.id, 'active')}
                                  className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-medium">
                                  ✓ Mark as Open
                                </button>
                              )}
                              {job.status !== 'closed' && (
                                <button onClick={() => handleStatusChange(job.id, 'closed')}
                                  className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-medium">
                                  ✗ Close Job
                                </button>
                              )}
                              {job.status !== 'draft' && (
                                <button onClick={() => handleStatusChange(job.id, 'draft')}
                                  className="block w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 font-medium">
                                  ○ Move to Draft
                                </button>
                              )}
                              <div className="border-t border-gray-100" />
                              <button onClick={() => handleDelete(job.id)}
                                className="block w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 font-medium">
                                Archive Job
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <h2 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-primary transition-colors leading-snug">
                      {job.title}
                    </h2>
                    {job.description && (
                      <p className="text-sm text-gray-500 line-clamp-2 mb-4">{job.description}</p>
                    )}

                    {/* Skills chips */}
                    {job.required_skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {job.required_skills.slice(0, 4).map(s => (
                          <span key={s} className="text-xs px-2 py-0.5 bg-purple-50 text-primary border border-primary/20 rounded-md font-medium">
                            {s}
                          </span>
                        ))}
                        {job.required_skills.length > 4 && (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md font-medium">
                            +{job.required_skills.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Card footer */}
                  <div className="border-t border-gray-100 px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(job.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                    <button
                      onClick={() => navigate(`/jobs/${job.id}`)}
                      className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                    >
                      <BarChart2 className="w-3.5 h-3.5" /> View Details
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Create Job Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Create Job Posting</h2>
                <button onClick={() => { setShowModal(false); setCreateErr(''); }}
                  className="text-gray-400 hover:text-gray-700 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className={labelClass}>Job Title *</label>
                  <input required value={form.title}
                    onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Senior Frontend Engineer"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Description</label>
                  <textarea value={form.description}
                    onChange={e => setForm({ ...form, description: e.target.value })}
                    rows={3} placeholder="Describe the role and responsibilities…"
                    className={`${inputClass} resize-none`} />
                </div>
                <div>
                  <label className={labelClass}>Required Skills <span className="text-gray-400 normal-case">(comma-separated)</span></label>
                  <input value={form.required_skills}
                    onChange={e => setForm({ ...form, required_skills: e.target.value })}
                    placeholder="React, TypeScript, Node.js"
                    className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Nice-to-Have Skills <span className="text-gray-400 normal-case">(comma-separated)</span></label>
                  <input value={form.nice_to_have_skills}
                    onChange={e => setForm({ ...form, nice_to_have_skills: e.target.value })}
                    placeholder="GraphQL, AWS, Docker"
                    className={inputClass} />
                </div>

                {createErr && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-4 py-2.5 rounded-lg">{createErr}</p>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button"
                    onClick={() => { setShowModal(false); setCreateErr(''); }}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={createMutation.isPending}
                    className="flex-1 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors">
                    {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                    {createMutation.isPending ? 'Creating…' : 'Create Job'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
