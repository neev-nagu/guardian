import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/layout/Header';
import LandingPage from './pages/LandingPage';
import HomePage from './pages/HomePage';
import DocumentPage from './pages/DocumentPage';
import DashboardPage from './pages/DashboardPage';
import FinancialStatementsPage from './pages/FinancialStatementsPage';
import TimeTravelPage from './pages/TimeTravelPage';
import DigitalTwinPage from './pages/DigitalTwinPage';
import AuthPage from './pages/AuthPage';
import ExpertRespondPage from './pages/ExpertRespondPage';
import './App.css';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading"><span>Loading…</span></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <div className="app">
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/signup" element={<AuthPage mode="signup" />} />
          <Route path="/upload" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
          <Route path="/document/:id" element={<ProtectedRoute><DocumentPage /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/financials" element={<ProtectedRoute><FinancialStatementsPage /></ProtectedRoute>} />
          <Route path="/time-travel" element={<ProtectedRoute><TimeTravelPage /></ProtectedRoute>} />
          <Route path="/digital-twin" element={<ProtectedRoute><DigitalTwinPage /></ProtectedRoute>} />
          <Route path="/respond/:opportunityId" element={<ExpertRespondPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
