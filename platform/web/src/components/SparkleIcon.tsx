/** Inline sparkles (no icon font); decorative / controls only. */
export function SparkleIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      <path
        d="M12 2l1.2 4.2L17 7l-3.8 1.7L12 13l-1.2-4.3L7 7l3.8-1.8L12 2z"
        fill="currentColor"
        className="sparkle-main"
      />
      <path
        d="M19 11l.7 2.4 2.4.8-2.4 1.1L19 18l-.7-2.6-2.4-1.1 2.4-.8.7-2.4z"
        fill="currentColor"
        opacity={0.85}
      />
      <path
        d="M5 14l.6 2.1 2.1.7-2.1.9L5 20l-.6-2.2-2.1-1 2.1-.7L5 14z"
        fill="currentColor"
        opacity={0.7}
      />
    </svg>
  );
}
