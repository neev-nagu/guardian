import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Mail, Lock, User, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export default function AuthPage({ mode = 'login' }) {
  const { login, register, googleLogin, user } = useAuth();
  const navigate = useNavigate();
  const googleBtn = useRef(null);

  const [isLogin, setIsLogin] = useState(mode === 'login');
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already logged in
  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  // Load Google Identity Services
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google?.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          setLoading(true);
          setError('');
          try {
            await googleLogin(response.credential);
            // navigation handled by useEffect after user state updates
          } catch (e) {
            setError(e.message);
          } finally {
            setLoading(false);
          }
        },
      });
      if (googleBtn.current) {
        window.google?.accounts.id.renderButton(googleBtn.current, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'continue_with',
        });
      }
    };
    document.head.appendChild(script);
    return () => script.remove();
  }, [googleLogin, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(form.email, form.password);
      } else {
        await register(form.email, form.password, form.name);
      }
      // navigation handled by useEffect after user state updates
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const hasGoogle = GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID !== 'YOUR_GOOGLE_CLIENT_ID_HERE';

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Logo */}
        <Link to="/" className="auth-logo">
          <Shield size={28} />
          <span>Papaya</span>
        </Link>

        <h1 className="auth-title">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
        <p className="auth-sub">
          {isLogin ? 'Sign in to access your fraud detection dashboard.' : 'Start protecting your finances in seconds.'}
        </p>

        {/* Google button */}
        {hasGoogle && (
          <>
            <div ref={googleBtn} className="auth-google-btn" />
            <div className="auth-divider"><span>or continue with email</span></div>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="auth-error">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="auth-field">
              <label>Full Name</label>
              <div className="auth-input-wrap">
                <User size={16} className="auth-input-icon" />
                <input
                  type="text"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label>Email</label>
            <div className="auth-input-wrap">
              <Mail size={16} className="auth-input-icon" />
              <input
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="auth-field">
            <label>Password</label>
            <div className="auth-input-wrap">
              <Lock size={16} className="auth-input-icon" />
              <input
                type={showPw ? 'text' : 'password'}
                placeholder={isLogin ? '••••••••' : 'At least 6 characters'}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
              />
              <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(s => !s)}>
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? <span className="spinner" style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} /> : null}
            {isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={16} />
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={() => { setIsLogin(l => !l); setError(''); }}>
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>

      {/* Background decoration */}
      <div className="auth-bg">
        <div className="auth-bg-card">
          <Shield size={16} className="auth-bg-icon" />
          <span>AI Fraud Detection</span>
        </div>
        <div className="auth-bg-card auth-bg-card--2">
          <span>✓ 61% risk flagged</span>
        </div>
        <div className="auth-bg-card auth-bg-card--3">
          <span>⚡ Results in seconds</span>
        </div>
      </div>
    </div>
  );
}
