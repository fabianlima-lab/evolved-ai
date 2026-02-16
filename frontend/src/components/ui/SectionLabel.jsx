export default function SectionLabel({ children, className = '' }) {
  return (
    <span
      className={`text-xs uppercase tracking-widest font-medium text-accent ${className}`}
    >
      {children}
    </span>
  );
}
