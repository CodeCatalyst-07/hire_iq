import client from './client';

export const uploadResume = async (file: File, jobId: string) => {
  const form = new FormData();
  form.append('file', file);
  form.append('job_id', jobId);
  const res = await client.post('/api/candidates/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
};

export const listCandidates = async (jobId: string, page = 1, limit = 20) => {
  const res = await client.get('/api/candidates', { params: { job_id: jobId, page, limit } });
  return res.data.data;
};

export const getCandidate = async (profileId: string) => {
  const res = await client.get(`/api/candidates/${profileId}`);
  return res.data.data;
};

export const updateCandidateStatus = async (profileId: string, status: string) => {
  const res = await client.patch(`/api/candidates/${profileId}`, { status });
  return res.data.data;
};

export const getDashboardStats = async () => {
  const res = await client.get('/api/dashboard/stats');
  return res.data.data;
};
