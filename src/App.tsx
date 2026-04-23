import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// ── Eager imports: first-visit pages & top-level nav items ───────────────────
import LandingPage from './components/LandingPage';
import LoginPage from './pages/LoginPage';
import Dashboard from './components/Dashboard';
import JobsPage from './components/JobsPage';
import InterviewsPage from './components/InterviewsPage';

// ── Lazy imports: heavy drill-down pages not needed on first render (Opt 7) ──
const JobDetailPage      = lazy(() => import('./components/JobDetailPage'));
const ComparisonPage     = lazy(() => import('./components/ComparisonPage'));
const CandidateProfile   = lazy(() => import('./components/CandidateProfile'));
const InterviewQuestions = lazy(() => import('./components/InterviewQuestions'));
const MockSession        = lazy(() => import('./components/MockSession'));
const FeedbackReport     = lazy(() => import('./components/FeedbackReport'));

// Shared fallback spinner shown while lazy chunks are downloading
function PageLoader() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { token } = useAuth();
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={token ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/dashboard"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/jobs"       element={<ProtectedRoute><JobsPage /></ProtectedRoute>} />
        <Route path="/jobs/:jobId" element={<ProtectedRoute><JobDetailPage /></ProtectedRoute>} />
        <Route path="/interviews" element={<ProtectedRoute><InterviewsPage /></ProtectedRoute>} />
        <Route path="/compare"    element={<ProtectedRoute><ComparisonPage /></ProtectedRoute>} />
        <Route path="/candidate/:id" element={<ProtectedRoute><CandidateProfile /></ProtectedRoute>} />
        <Route path="/interview/questions/:bankId" element={<ProtectedRoute><InterviewQuestions /></ProtectedRoute>} />
        <Route path="/interview/session/:sessionId" element={<ProtectedRoute><MockSession /></ProtectedRoute>} />
        <Route path="/interview/feedback/:sessionId" element={<ProtectedRoute><FeedbackReport /></ProtectedRoute>} />
      </Routes>
    </Suspense>
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
