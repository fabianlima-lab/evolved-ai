'use client';

export default function SupportButton() {
  return (
    <a
      href="mailto:support@evolved.ai"
      className="fixed bottom-5 right-5 z-[60] w-12 h-12 rounded-full bg-card border border-border flex items-center justify-center text-txt-muted hover:text-accent hover:border-accent transition-all shadow-lg"
      title="Contact Support"
      aria-label="Contact Support"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    </a>
  );
}
