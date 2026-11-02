import { PANORAMAS } from '../content/panoramas.js'

const PANO = Object.fromEntries(PANORAMAS.map((p) => [p.id, p]))

// Real pictures the app already carries: the rovers' panoramas, the orbital layers it maps,
// and the planner itself. Credits are on the Data & sources page and in the footer.
export const PICTURES = {
  butler: { src: '/data/panoramas/butler-3k.webp', w: 3000, h: 796, pos: '9% 0', crop: 1.3, alt: PANO.butler.alt, cap: 'Perseverance’s landing spot, Jezero' },
  vanzyl: { src: '/data/panoramas/vanzyl-3k.webp', w: 3000, h: 666, pos: '70% 0', crop: 1.4, alt: PANO.vanzyl.alt, cap: 'Van Zyl Overlook, Jezero' },
  mercou: { src: '/data/panoramas/mercou-3k.webp', w: 3000, h: 812, pos: '60% 0', crop: 1.3, alt: PANO.mercou.alt, cap: 'Mont Mercou, Gale Crater' },
  hirise: { src: '/data/jezero/hirise-2k.webp', w: 2048, h: 1360, pos: '45% 55%', crop: 1.12, alt: 'HiRISE photo of the floor of Jezero Crater: sand ripples, small craters and a pale rocky ridge.', cap: 'HiRISE, Jezero floor' },
  ctx: { src: '/data/jezero/ctx-photo-2k.webp', w: 2048, h: 2046, pos: '50% 50%', alt: 'CTX photo of the Jezero region from orbit, with the crater floor and the old river delta.', cap: 'CTX, the Jezero region' },
  themis: { src: '/data/jezero/themis-day.webp', w: 1800, h: 1476, pos: '50% 50%', alt: 'THEMIS daytime infrared image of the Jezero region.', cap: 'THEMIS daytime heat' },
  viking: { src: '/data/jezero/viking.webp', w: 1400, h: 1148, pos: '50% 50%', alt: 'Viking colour mosaic of the region around Jezero Crater.', cap: 'Viking colour mosaic' },
  planner: { src: '/home/planner-after.webp', w: 1600, h: 900, pos: '0 0', alt: 'The Redstep planner with a route drawn at Jezero and a GO answer.', cap: 'The planner’s GO answer' },
  map: { src: '/home/map.webp', w: 1600, h: 900, pos: '60% 50%', alt: 'The Redstep Mars map: a globe with landing sites.', cap: 'The Mars map' },
}

/** Four real pictures butted together in one band, like a plate in a printed report. */
export default function PictureBand({ ids, className = '' }) {
  const pics = ids.map((id) => PICTURES[id])
  return (
    <figure className={`band ${className}`}>
      <div className="band__grid">
        {pics.map((p) => (
          <div key={p.src} className="band__cell">
            {/* crop: zoom into the top of a panorama, past the gaps where no frames were taken */}
            <img src={p.src} alt={p.alt} width={p.w} height={p.h} loading="lazy" style={{ objectPosition: p.pos, scale: p.crop, transformOrigin: '50% 0' }} />
          </div>
        ))}
      </div>
      <figcaption>{pics.map((p) => p.cap).join(' · ')}</figcaption>
    </figure>
  )
}
