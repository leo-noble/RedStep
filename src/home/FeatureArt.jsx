/**
 * Small looping illustrations for the feature cards. They animate in place (CSS in home.css
 * under .fa-*, plus SVG motion for the orbiters and the walker), stay still for reduced motion, and are decoration: hidden from screen
 * readers, with the meaning carried by each card's text.
 */
import { useReducedMotion } from '../lib/hooks.js'

export default function FeatureArt({ kind }) {
  const still = useReducedMotion()
  return (
    <svg className={`fa fa-${kind}`} viewBox="0 0 240 140" aria-hidden="true" focusable="false">
      {kind === 'layers' && <Layers />}
      {kind === 'missions' && <Missions still={still} />}
      {kind === 'walk' && <Walk still={still} />}
      {kind === 'science' && <Science />}
    </svg>
  )
}

// Three map layers lifting apart and settling back: height, photo, rock-or-dust.
function Layers() {
  const sheet = 'M60 0 L120 -22 L180 0 L120 22 Z'
  const layers = [
    { name: 'THEMIS', fill: 'rgba(127,176,255,0.14)', line: 'rgba(127,176,255,0.6)' },
    { name: 'HiRISE', fill: 'rgba(236,125,69,0.18)', line: 'rgba(236,125,69,0.7)' },
    { name: 'MOLA', fill: 'rgba(255,178,91,0.16)', line: 'rgba(255,178,91,0.85)' },
  ]
  return (
    <g transform="translate(0 102)">
      {layers.map((l, i) => (
        <g key={l.name} transform={`translate(0 ${(i - 2) * 26})`}>
          <g className={`fa-layer fa-layer-${i}`}>
            <path d={sheet} fill={l.fill} stroke={l.line} />
            {i === 2 && <path d="M84 2 Q105 -8 120 4 T156 0" fill="none" stroke="rgba(255,178,91,0.8)" strokeWidth="1.5" />}
            <text x="190" y="4">{l.name}</text>
          </g>
        </g>
      ))}
    </g>
  )
}

// Mars with three orbiters going round at different speeds.
function Missions({ still }) {
  return (
    <g transform="translate(120 70)">
      <defs>
        <radialGradient id="fa-mars" cx="35%" cy="35%" r="70%">
          <stop offset="0" stopColor="#de8d63" />
          <stop offset="1" stopColor="#542f24" />
        </radialGradient>
      </defs>
      {[{ r: 40, dur: 6, at: 20 }, { r: 52, dur: 9, at: 150 }, { r: 64, dur: 13, at: 260 }].map((o) => (
        <g key={o.r} transform="scale(1 0.42)">
          <circle r={o.r} fill="none" stroke="rgba(255,255,255,0.14)" strokeDasharray="2 4" />
          <g transform={`rotate(${o.at})`}>
            {!still && <animateTransform attributeName="transform" type="rotate" from={o.at} to={o.at + 360} dur={`${o.dur}s`} repeatCount="indefinite" />}
            <circle cx={o.r} cy="0" r="3.4" fill="#7fb0ff" />
          </g>
        </g>
      ))}
      <circle r="26" fill="url(#fa-mars)" />
    </g>
  )
}

// A route drawing itself from the habitat, a walker following it, the verdict lighting up.
function Walk({ still }) {
  const route = 'M30 110 C 70 100, 70 60, 110 62 S 170 40, 200 30'
  return (
    <g>
      <path d="M0 126 L240 126" stroke="rgba(255,255,255,0.08)" />
      <path d={route} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="6" strokeLinecap="round" />
      <path className="fa-route" d={route} fill="none" stroke="#ffb25b" strokeWidth="2.5" strokeLinecap="round" pathLength="1" />
      <circle cx="30" cy="110" r="6" fill="#f5f7fb" />
      <circle className="fa-walker" r="4.5" fill="#00e5ff" cx={still ? 200 : 0} cy={still ? 30 : 0}>
        {!still && <animateMotion dur="5s" repeatCount="indefinite" path={route} keyPoints="0;1;1" keyTimes="0;0.7;1" calcMode="linear" />}
      </circle>
      <g className="fa-go" transform="translate(170 86)">
        <rect width="52" height="22" rx="11" fill="rgba(127,224,168,0.16)" stroke="rgba(127,224,168,0.7)" />
        <text x="26" y="15" textAnchor="middle">GO</text>
      </g>
    </g>
  )
}

// A crater rim with science stops lighting up one after another.
function Science() {
  return (
    <g transform="translate(120 72)">
      <ellipse rx="88" ry="40" fill="rgba(236,125,69,0.08)" stroke="rgba(236,125,69,0.45)" />
      <ellipse rx="62" ry="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeDasharray="3 5" />
      {[[-50, -6], [-12, 14], [24, -14], [58, 8]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle className={`fa-ping fa-ping-${i}`} r="10" fill="none" stroke="#7fe0a8" />
          <circle r="4" fill="#7fe0a8" />
        </g>
      ))}
    </g>
  )
}
