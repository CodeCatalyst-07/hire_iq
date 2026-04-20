import client from './client';

export const listJobs = async () => {
  const res = await client.get('/api/jobs');
  return res.data.data;
};

export const createJob = async (data: {
  title: string;
  description?: string;
  required_skills: string[];
  nice_to_have_skills: string[];
}) => {
  const res = await client.post('/api/jobs', data);
  return res.data.data;
};

export const getJob = async (jobId: string) => {
  const res = await client.get(`/api/jobs/${jobId}`);
  return res.data.data;
};

export const updateJob = async (jobId: string, data: {
  title?: string;
  description?: string;
  required_skills?: string[];
  nice_to_have_skills?: string[];
  status?: string;
}) => {
  const res = await client.patch(`/api/jobs/${jobId}`, data);
  return res.data.data;
};

export const deleteJob = async (jobId: string) => {
  await client.delete(`/api/jobs/${jobId}`);
};

export const getJobStats = async (jobId: string) => {
  const res = await client.get(`/api/jobs/${jobId}/stats`);
  return res.data.data;
};
