import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';
import CandidateProfile from './components/CandidateProfile';
import InterviewQuestions from './components/InterviewQuestions';
import MockSession from './components/MockSession';
import FeedbackReport from './components/FeedbackReport';
import LoginPage from './pages/LoginPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  );
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { token } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/candidate/:id" element={<ProtectedRoute><CandidateProfile /></ProtectedRoute>} />
      <Route path="/interview/questions/:bankId" element={<ProtectedRoute><InterviewQuestions /></ProtectedRoute>} />
      <Route path="/interview/session/:sessionId" element={<ProtectedRoute><MockSession /></ProtectedRoute>} />
      <Route path="/interview/feedback/:sessionId" element={<ProtectedRoute><FeedbackReport /></ProtectedRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
          <AppRoutes />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
