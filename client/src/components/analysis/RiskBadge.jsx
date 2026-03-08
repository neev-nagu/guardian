export default function RiskBadge({ severity }) {
  return (
    <span className={`risk-badge risk-badge--${severity}`}>
      {severity}
    </span>
  );
}
