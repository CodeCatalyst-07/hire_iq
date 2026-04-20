import client from './client';

export const generateQuestions = async (profileId: string, jobId: string) => {
  const res = await client.post('/api/questions/generate', {
    profile_id: profileId,
    job_id: jobId,
  });
  return res.data.data;
};

export const getQuestionBank = async (questionBankId: string) => {
  const res = await client.get(`/api/questions/${questionBankId}`);
  return res.data.data;
};

export const startSession = async (candidateId: string, jobId: string, questionBankId: string) => {
  const res = await client.post('/api/sessions', {
    candidate_id: candidateId,
    job_id: jobId,
    question_bank_id: questionBankId,
    mode: 'practice',
  });
  return res.data.data;
};

export const submitAnswer = async (sessionId: string, questionId: string, answerText: string) => {
  const res = await client.post(`/api/sessions/${sessionId}/answers`, {
    question_id: questionId,
    answer_text: answerText,
  });
  return res.data.data;
};

export const completeSession = async (sessionId: string) => {
  const res = await client.post(`/api/sessions/${sessionId}/complete`);
  return res.data.data;
};

export const getSessionReport = async (sessionId: string) => {
  const res = await client.get(`/api/sessions/${sessionId}/report`);
  return res.data.data;
};

export const listSessions = async (jobId?: string) => {
  const res = await client.get('/api/sessions', { params: jobId ? { job_id: jobId } : {} });
  return res.data.data as SessionListItem[];
};

export const getInsights = async (jobId?: string) => {
  const res = await client.get('/api/sessions/insights', { params: jobId ? { job_id: jobId } : {} });
  return res.data.data as SessionInsights;
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  await client.delete(`/api/sessions/${sessionId}`);
};

// ── Types ──────────────────────────────────────────────────────────────────

export type SessionListItem = {
  id: string;
  candidate_name: string;
  job_title: string;
  status: string;
  overall_score: number;
  started_at: string | null;
  completed_at: string | null;
}

export type SessionInsights = {
  total_sessions: number;
  completed_sessions: number;
  avg_overall_score: number;
  dimensions: {
    relevance: number;
    clarity: number;
    depth: number;
    confidence: number;
    structure: number;
  };
  weakest_dimension: string;
}
