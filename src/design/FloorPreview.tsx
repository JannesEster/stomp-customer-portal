import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { effectsConfig, findEffect, findFont, findTemplate, portalConfig, type EffectDef } from '../config';
import { floorPixels } from '../lib/dimensions';
import { holdingFor } from '../lib/design';
import { drawHoldingScreen } from '../lib/holdingRender';
import { useFileUrl, useImage } from '../hooks/useFileUrl';
import type { Booking, DesignState, Phase } from '../types';
import { Accent, EffectAsset, PhaseSwitch, Section, phaseLabel } from './common';

interface Burst {
  id: number;
  effect: EffectDef;
  x: number;
  y: number;
  dx: number;
  dy: number;
  delay: number;
}

const STEP_THROTTLE_MS = 110;
const AUTO_STEP_MS = 380;

export function FloorPreview({
  booking,
  design,
  phase,
  onPhaseChange,
}: {
  booking: Booking;
  design: DesignState;
  phase: Phase;
  onPhaseChange: (p: Phase) => void;
}) {
  const px = floorPixels(booking.floor.widthM, booking.floor.lengthM);
  const holding = holdingFor(design, phase);
  const photo = useImage(useFileUrl(holding.photo.file));
  const [grid, setGrid] = useState(false);
  const [autoSteps, setAutoSteps] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawHoldingScreen(ctx, {
      width: px.width,
      height: px.height,
      design: holding,
      template: findTemplate(holding.templateId),
      font: findFont(holding.fontId),
      photo,
      grid: grid ? { tilePx: portalConfig.floor.tilePx } : null,
    });
  }, [px.width, px.height, holding, photo, grid]);

  const effects = design.reactions[phase].map(findEffect).filter((e): e is EffectDef => !!e);
  const { bursts, spawn } = useBursts(effects);
  const lastStep = useRef(0);

  const stepAt = (e: PointerEvent<HTMLDivElement>, force: boolean) => {
    const now = performance.now();
    if (!force && now - lastStep.current < STEP_THROTTLE_MS) return;
    lastStep.current = now;
    const r = e.currentTarget.getBoundingClientRect();
    spawn(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
  };

  useEffect(() => {
    if (!autoSteps) return;
    const t = window.setInterval(() => spawn(5 + Math.random() * 90, 5 + Math.random() * 90), AUTO_STEP_MS);
    return () => window.clearInterval(t);
  }, [autoSteps, spawn]);

  const sizePct = ((effectsConfig.sizeTiles * portalConfig.floor.tilePx) / px.width) * 100;
  const ratio = px.width / px.height;

  return (
    <Section
      title={
        <>
          Floor <Accent>preview</Accent>
        </>
      }
      intro="This is your dance floor at its exact size. Tap or move across it to see the reactions you've picked."
    >
      <div className="toolbar">
        <PhaseSwitch value={phase} onChange={onPhaseChange} label="Preview phase" />
        <label className="check">
          <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Show tile grid
        </label>
        <label className="check">
          <input type="checkbox" checked={autoSteps} onChange={(e) => setAutoSteps(e.target.checked)} /> Simulate
          dancers
        </label>
      </div>

      <div
        className="floor-frame"
        style={{ aspectRatio: `${px.width} / ${px.height}`, width: `min(100%, calc(62vh * ${ratio}))` }}
      >
        <canvas
          ref={canvasRef}
          width={px.width}
          height={px.height}
          className="floor-canvas"
          aria-label={`${phaseLabel(phase)} holding screen preview`}
        />
        <div
          className="reaction-layer"
          onPointerDown={(e) => stepAt(e, true)}
          onPointerMove={(e) => stepAt(e, false)}
        >
          {bursts.map((b) => (
            <EffectAsset
              key={b.id}
              effect={b.effect}
              className={`reaction anim-${b.effect.animation}`}
              style={
                {
                  left: `${b.x}%`,
                  top: `${b.y}%`,
                  width: `${sizePct}%`,
                  animationDuration: `${effectsConfig.durationMs}ms`,
                  animationDelay: `${b.delay}ms`,
                  '--dx': `${b.dx}%`,
                  '--dy': `${b.dy}%`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      </div>

      <p className="floor-meta">
        <strong>
          {px.width} x {px.height} px
        </strong>{' '}
        <span className="muted">
          {booking.floor.widthM}m x {booking.floor.lengthM}m, {px.tilesX} x {px.tilesY} tiles
        </span>
      </p>
      {effects.length === 0 && (
        <p className="muted small">No reactions picked for {phaseLabel(phase).toLowerCase()} yet. Choose some below.</p>
      )}
    </Section>
  );
}

function useBursts(effects: EffectDef[]) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useRef(1);
  const effectsRef = useRef(effects);
  effectsRef.current = effects;

  const spawn = useCallback((x: number, y: number) => {
    const list = effectsRef.current;
    if (!list.length) return;
    const effect = list[Math.floor(Math.random() * list.length)];
    const created: Burst[] = Array.from({ length: Math.max(1, effect.count) }, (_, i) => ({
      id: nextId.current++,
      effect,
      x: x + (effect.count > 1 ? (Math.random() - 0.5) * 6 : 0),
      y: y + (effect.count > 1 ? (Math.random() - 0.5) * 6 : 0),
      dx: (Math.random() - 0.5) * 120,
      dy: -60 - Math.random() * 120,
      delay: i * 70,
    }));
    setBursts((b) => [...b, ...created]);
    const ids = new Set(created.map((c) => c.id));
    window.setTimeout(
      () => setBursts((b) => b.filter((x) => !ids.has(x.id))),
      effectsConfig.durationMs + created.length * 70 + 50,
    );
  }, []);

  return { bursts, spawn };
}
