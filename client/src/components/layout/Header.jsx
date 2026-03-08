import { Link } from 'react-router-dom';
import { Shield, LayoutDashboard, Upload, TrendingUp } from 'lucide-react';
import MoneySaved from '../dashboard/MoneySaved';

export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="logo">
          <Shield size={28} />
          <span>Guardian</span>
        </Link>
        <nav className="nav">
          <Link to="/" className="nav-link">
            <Upload size={16} />
            Upload
          </Link>
          <Link to="/dashboard" className="nav-link">
            <LayoutDashboard size={16} />
            Dashboard
          </Link>
          <Link to="/financials" className="nav-link">
            <TrendingUp size={16} />
            Financials
          </Link>
        </nav>
      </div>
      <MoneySaved />
    </header>
  );
}
