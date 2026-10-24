// The signature hairline orbit diagram: Sun, Earth with the Moon, Mars, and a transfer arc.
export default function Orbits({ className = '', transfer = true, label = false }) {
  return (
    <svg className={className} viewBox="0 0 600 600" aria-hidden="true" fill="none">
      <g stroke="#fff">
        <circle cx="300" cy="300" r="150" strokeOpacity=".16" />
        <circle cx="300" cy="300" r="228" strokeOpacity=".12" />
        <circle cx="300" cy="300" r="290" strokeOpacity=".05" strokeDasharray="2 6" />
        <circle cx="194" cy="194" r="22" strokeOpacity=".14" />
      </g>
      {transfer && <path d="M194 194 C 120 330, 300 560, 462 452" stroke="var(--rust)" strokeOpacity=".7" strokeDasharray="3 5" />}
      <circle cx="300" cy="300" r="3" fill="var(--ember)" />
      <circle cx="194" cy="194" r="6" fill="var(--ice)" />
      <circle cx="210" cy="180" r="2" fill="#cfcfcf" />
      <circle cx="462" cy="452" r="5" fill="var(--rust)" />
      {label && (
        <g fontFamily="var(--mono)" fontSize="11" fill="rgba(245,247,251,.5)" letterSpacing="1.5">
          <text x="150" y="160">EARTH</text>
          <text x="476" y="470">MARS</text>
          <text x="312" y="306">SUN</text>
        </g>
      )}
    </svg>
  )
}
