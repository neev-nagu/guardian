import { Link, useNavigate } from 'react-router-dom';
import { Shield, LayoutDashboard, Upload, TrendingUp, Clock, Layers, LogOut, LogIn } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="logo">
          <Shield size={24} />
          <span>Papaya</span>
        </Link>
        {user && (
          <nav className="nav">
            <Link to="/upload" className="nav-link"><Upload size={15} /> Upload</Link>
            <Link to="/dashboard" className="nav-link"><LayoutDashboard size={15} /> Dashboard</Link>
            <Link to="/financials" className="nav-link"><TrendingUp size={15} /> Financials</Link>
            <Link to="/time-travel" className="nav-link"><Clock size={15} /> Time Travel</Link>
            <Link to="/digital-twin" className="nav-link"><Layers size={15} /> Digital Twin</Link>
          </nav>
        )}
      </div>

      <div className="header-right">
        {user ? (
          <div className="header-user">
            {user.avatar
              ? <img src={user.avatar} className="header-avatar" alt={user.name} referrerPolicy="no-referrer" />
              : <div className="header-avatar-initials">{(user.name || user.email)[0].toUpperCase()}</div>
            }
            <span className="header-user-name">{user.name || user.email.split('@')[0]}</span>
            <button className="header-logout" onClick={handleLogout} title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <Link to="/login" className="header-login-btn">
            <LogIn size={15} /> Sign In
          </Link>
        )}
      </div>
    </header>
  );
}
