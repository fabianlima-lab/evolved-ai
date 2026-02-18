export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-card border border-border rounded-[var(--radius-card)] shadow-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
