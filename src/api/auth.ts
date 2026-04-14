import client from './client';

export const register = async (data: { email: string; password: string; full_name: string; role?: string }) => {
  const res = await client.post('/api/auth/register', data);
  return res.data.data;
};

export const login = async (data: { email: string; password: string }) => {
  const res = await client.post('/api/auth/login', data);
  return res.data.data;
};

export const getMe = async () => {
  const res = await client.get('/api/auth/me');
  return res.data.data;
};
