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
