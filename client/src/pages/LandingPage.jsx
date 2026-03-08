import { Link } from 'react-router-dom'
import { Shield, Brain, BarChart2, Clock, Layers, Users, ArrowRight, CheckCircle, FileText, Zap } from 'lucide-react'

// feature cards shown in the middle section
const FEATURES = [
  {
    icon: <Brain size={28} />,
    title: 'AI Fraud Detection',
    desc: 'Random Forest ML model trained on thousands of invoices, combined with Gemini AI analysis to catch billing anomalies before they cost you.',
    color: 'blue',
  },
  {
    icon: <BarChart2 size={28} />,
    title: 'Rule-Based Checks',
    desc: 'Automated validation of math totals, duplicate line items, round number patterns, split invoices, and vendor anomalies.',
    color: 'teal',
  },
  {
    icon: <Clock size={28} />,
    title: 'Time Travel Accountant',
    desc: 'Audit your entire financial history and forecast future expenses using linear regression on your real transaction data.',
    color: 'orange',
  },
  {
    icon: <Layers size={28} />,
    title: 'Digital Twin',
    desc: 'Simulate financial scenarios, adjust revenue or cut expense categories and instantly see the ripple effects on your bottom line.',
    color: 'blue',
  },
  {
    icon: <FileText size={28} />,
    title: 'Financial Statements',
    desc: 'Auto-generated income statements, balance sheets, and cash flow statements from your uploaded documents. Always balanced.',
    color: 'teal',
  },
  {
    icon: <Users size={28} />,
    title: 'Expert Advisors via Terac',
    desc: 'Launch research studies and get real financial experts to review flagged documents through the Terac platform.',
    color: 'orange',
  },
]

// numbered steps for the how it works section
const STEPS = [
  { step: '01', title: 'Upload a Document', desc: 'Drag and drop any receipt, invoice, or bank statement. JPG, PNG, or PDF.' },
  { step: '02', title: 'AI Analysis Runs', desc: 'Gemini Vision extracts data, the ML model scores fraud risk, and rule checks validate every line item.' },
  { step: '03', title: 'Review the Report', desc: 'See exactly what is wrong, what is suspicious, and what the model found, all in one place.' },
  { step: '04', title: 'Take Action', desc: 'Dispute with AI-generated messages or connect directly with a financial expert via Terac.' },
]

export default function LandingPage() {
  return (
    <div className="landing">

      {/* hero section with the fake fraud card visual */}
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-badge">
            <Zap size={13} /> AI-Powered Financial Protection
          </div>
          <h1 className="landing-hero-title">
            Stop Paying for<br />
            <span className="landing-hero-accent">Billing Errors</span>
          </h1>
          <p className="landing-hero-sub">
            Papaya uses machine learning, rule-based checks, and AI analysis to detect fraud,
            flag overcharges, and protect your business finances automatically.
          </p>
          <div className="landing-hero-cta">
            <Link to="/dashboard" className="landing-btn landing-btn--primary">
              Go to Dashboard <ArrowRight size={16} />
            </Link>
            <Link to="/upload" className="landing-btn landing-btn--secondary">
              Upload a Document
            </Link>
          </div>
          <div className="landing-hero-trust">
            <span><CheckCircle size={14} /> No billing information needed</span>
            <span><CheckCircle size={14} /> Files processed locally</span>
            <span><CheckCircle size={14} /> Results in seconds</span>
          </div>
        </div>

        {/* decorative preview card floating on the right */}
        <div className="landing-hero-visual">
          <div className="landing-hero-card landing-hero-card--main">
            <div className="lhc-header">
              <Shield size={18} className="lhc-shield" />
              <span>Fraud Analysis Complete</span>
            </div>
            <div className="lhc-score">
              <div className="lhc-score-ring">
                <svg viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#e0f2fe" strokeWidth="8" />
                  <circle cx="40" cy="40" r="34" fill="none" stroke="#f97316" strokeWidth="8"
                    strokeDasharray="130 84" strokeLinecap="round" transform="rotate(-90 40 40)" />
                </svg>
                <span>61%</span>
              </div>
              <div>
                <strong>Fraud Probability</strong>
                <span className="lhc-label">High Risk Detected</span>
              </div>
            </div>
            <div className="lhc-flags">
              <div className="lhc-flag lhc-flag--red">⚠ Duplicate line items found</div>
              <div className="lhc-flag lhc-flag--orange">⚠ Math total mismatch: $4.20</div>
              <div className="lhc-flag lhc-flag--green">✓ Vendor names normal</div>
            </div>
          </div>
          <div className="landing-hero-card landing-hero-card--sm landing-hero-card--float1">
            <Clock size={16} />
            <span>Forecast: +12% expense<br />growth next quarter</span>
          </div>
          <div className="landing-hero-card landing-hero-card--sm landing-hero-card--float2">
            <Layers size={16} />
            <span>Digital Twin:<br />-20% OpEx saves $8.4k</span>
          </div>
        </div>
      </section>

      {/* feature grid */}
      <section className="landing-section">
        <div className="landing-section-label">What Papaya Does</div>
        <h2 className="landing-section-title">Everything you need to protect your finances</h2>
        <div className="landing-features">
          {FEATURES.map(f => (
            <div key={f.title} className={`landing-feature landing-feature--${f.color}`}>
              <div className="landing-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* numbered steps */}
      <section className="landing-section landing-section--alt">
        <div className="landing-section-label">How It Works</div>
        <h2 className="landing-section-title">From upload to insight in seconds</h2>
        <div className="landing-steps">
          {STEPS.map((s, i) => (
            <div key={s.step} className="landing-step">
              <div className="landing-step-num">{s.step}</div>
              {i < STEPS.length - 1 && <div className="landing-step-connector" />}
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* bottom cta */}
      <section className="landing-cta-section">
        <Shield size={40} className="landing-cta-icon" />
        <h2>Ready to protect your finances?</h2>
        <p>Upload your first document and get a full fraud analysis in under 30 seconds.</p>
        <Link to="/upload" className="landing-btn landing-btn--primary landing-btn--lg">
          Get Started Free <ArrowRight size={18} />
        </Link>
      </section>

    </div>
  )
}
