import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Header from './components/layout/Header';
import HomePage from './pages/HomePage';
import DocumentPage from './pages/DocumentPage';
import DashboardPage from './pages/DashboardPage';
import FinancialStatementsPage from './pages/FinancialStatementsPage';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Header />
        <main className="main">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/document/:id" element={<DocumentPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/financials" element={<FinancialStatementsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
