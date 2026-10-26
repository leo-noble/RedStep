import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createHeroScene } from './three/heroScene.js';
import { globeTexture } from '../data/index.js';
import { fmtLat, fmtLon } from './format.js';

/**
 * WebGL stage: Earth → Moon → Mars cinematic, dot-matrix rocket, orbital
 * hairlines and the interactive Mars globe with landing-site pins.
 * The engine drives it; this component renders once and never re-renders per frame.
 */
export default function MarsGlobeHero({ engine, sites, selectedId, onSelect, onArrive, ref }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const labels = { earth: useRef(null), moon: useRef(null), mars: useRef(null) };
  const pinRefs = useRef(new Map());
  const exitRef = useRef(null);
  const onArriveRef = useRef(onArrive);
  onArriveRef.current = onArrive;
  const [failed, setFailed] = useState(false);

  useImperativeHandle(ref, () => ({
    flyTo: (id) => sceneRef.current?.flyTo(id),
    setLighting: (m) => sceneRef.current?.setLighting(m),
    isInteractive: () => sceneRef.current?.isInteractive() ?? false,
  }));

  useEffect(() => {
    const wrap = wrapRef.current;
    let scene;
    try {
      scene = createHeroScene(canvasRef.current, {
        sites,
        dom: {
          labels: { earth: labels.earth.current, moon: labels.moon.current, mars: labels.mars.current },
          pins: pinRefs.current,
          exit: exitRef.current,
        },
        onArrive: (id) => onArriveRef.current?.(id),
        // Real NASA planet maps from the app's data folder; the procedural ones stay as fallback.
        textures: { mars: globeTexture('mars-viking-2k.jpg'), earth: globeTexture('earth-day-2k.jpg'), moon: globeTexture('moon-lro-2k.jpg') },
      });
    } catch (err) {
      console.warn('[MarsGlobeHero] WebGL unavailable, using static poster.', err);
      setFailed(true);
      return undefined;
    }
    sceneRef.current = scene;
    if (import.meta.env.DEV) window.__marswalkScene = scene;

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      scene.resize(width, height);
      engine.requestFrame();
    });
    ro.observe(wrap);

    let visible = true;
    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        engine.setActive(visible);
      },
      { threshold: 0 },
    );
    io.observe(wrap);

    const unsub = engine.subscribe((state) => {
      if (visible) scene.update(state);
    });

    return () => {
      unsub();
      io.disconnect();
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
    // The scene is created once; sites are static content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  useEffect(() => {
    sceneRef.current?.setSelected(selectedId);
  }, [selectedId]);

  return (
    <div className="hero-stage" ref={wrapRef} data-failed={failed ? 'true' : 'false'}>
      <canvas
        ref={canvasRef}
        className="hero-canvas"
        aria-label="Animated schematic: a rocket leaves Earth, passes the Moon's orbit and arrives at Mars. In the final chapter the Mars globe can be dragged to rotate."
        role="img"
      />
      {failed && <div className="hero-poster" aria-hidden="true" />}

      <div className="hero-labels" aria-hidden="true">
        <span className="body-label" ref={labels.earth}>
          <i />
          <b>Earth</b>
          <em>Departure</em>
        </span>
        <span className="body-label" ref={labels.moon}>
          <i />
          <b>Moon</b>
          <em>384 400 km</em>
        </span>
        <span className="body-label body-label--left" ref={labels.mars}>
          <i />
          <b>Mars</b>
          <em>Destination</em>
        </span>
      </div>

      <div className="hero-pins">
        {sites.map((s) => (
          <button
            key={s.id}
            type="button"
            className="pin"
            data-active={s.id === selectedId ? 'true' : 'false'}
            tabIndex={-1}
            ref={(el) => {
              if (el) pinRefs.current.set(s.id, el);
              else pinRefs.current.delete(s.id);
            }}
            onMouseEnter={() => onSelect?.(s.id)}
            onFocus={() => onSelect?.(s.id)}
            onClick={() => {
              onSelect?.(s.id);
              sceneRef.current?.flyTo(s.id);
            }}
            aria-label={`Fly to ${s.name}, ${fmtLat(s.lat)} ${fmtLon(s.lon)}`}
          >
            <span className="pin__dot" aria-hidden="true" />
            <span className="pin__label" aria-hidden="true">
              <b>{s.name}</b>
              <em>
                {fmtLat(s.lat)} · {fmtLon(s.lon)}
              </em>
            </span>
          </button>
        ))}
      </div>

      <div className="hero-exit" ref={exitRef} aria-hidden="true" />
    </div>
  );
}

