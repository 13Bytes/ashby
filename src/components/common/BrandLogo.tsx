/** PolyPlot logo (docs/polyplot-logo.svg): axes and points in the text color, one point in the brand blue. */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 140" className={className} aria-hidden="true">
      <path d="M 12,12 L 12,120 L 122,120" fill="none" stroke="currentColor" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="38" cy="58" r="19" fill="#219CD3" />
      <circle cx="82" cy="98" r="11" fill="currentColor" />
      <circle cx="104" cy="72" r="14" fill="currentColor" />
    </svg>
  )
}
