/* The brand mark: a gaanth — the knot tied between the bride's dupatta and
   the groom's stole before the pheras. Two loops, one line. Drawn in
   currentColor so it takes whatever ink or accent surrounds it. */
export function Mark({ size = 20, className, style }: { size?: number | string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      style={style}
    >
      <path d="M12.5 9.5c-5 0-7.5 3-7.5 6.5s2.5 6.5 7.5 6.5c3.2 0 5.2-2.2 6.5-4.6" />
      <path d="M19.5 22.5c5 0 7.5-3 7.5-6.5s-2.5-6.5-7.5-6.5c-3.2 0-5.2 2.2-6.5 4.6" />
    </svg>
  );
}
