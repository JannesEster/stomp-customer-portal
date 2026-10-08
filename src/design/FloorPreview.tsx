import { useEffect, useRef, useState } from 'react';
import {
  dancingVideosConfig,
  findEffect,
  findStyle,
  holdingStylesConfig,
  portalConfig,
  type EffectDef,
  type LiveTextDef,
} from '../config';
import { floorPixels, SAMPLE_FLOOR } from '../lib/dimensions';
import { holdingFor, reactionsFor, showsDancingVideos } from '../lib/design';
import { drawFloor } from '../lib/floorRender';
import { fontsToLoad } from '../lib/liveText';
import { generatedFonts } from '../lib/generatedRender';
import { generatedFor } from '../lib/inviteStyle';
import type { Booking, DesignState, Phase } from '../types';
import { Accent, PhaseSwitch, Section, phaseLabel } from './common';

/** Names on a plain floor until a style is picked. Positions are fractions of the whole floor. */
const PLAIN_NAMES: LiveTextDef = {
  names: {
    layout: 'line',
    x: 0.5,
    y: 0.5,
    size: 0.14,
    font: 'playfair',
    weight: 700,
    italic: true,
    colour: '#ffffff',
    maxWidth: 0.8,
  },
};

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
  const floor = booking.floor ?? SAMPLE_FLOOR;
  const px = floorPixels(floor.widthM, floor.lengthM);
  const holding = holdingFor(design, phase);
  const generated = generatedFor(design, holding?.styleId);
  const style = generated ? undefined : findStyle(holding?.styleId ?? null);
  const [grid, setGrid] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const names = holding?.names ?? '';
  const plain = !!holding && !style && !generated;
  const plainNames = plain && !!names.trim();
  const liveDef = style?.live ?? (plainNames ? PLAIN_NAMES : null);
  const message = plain && !plainNames ? 'Your names will show here' : null;
  const playlist = showsDancingVideos(design, phase) ? dancingVideosConfig.videos : null;
  const clipTurn = useRotation(!!playlist, dancingVideosConfig.rotateSeconds);
  const clip = playlist ? playlist[clipTurn % playlist.length] : null;
  const videoSrc = style?.video ?? clip?.src ?? null;
  const namesColour = design.inviteNamesColour;
  const eventDate = booking.eventDate;
  const fonts = holdingStylesConfig.fonts;

  useEffect(() => {
    const list = generated ? generatedFonts(generated, fonts) : liveDef ? fontsToLoad(liveDef, fonts) : [];
    for (const f of list) void document.fonts.load(f);
  }, [liveDef, generated, fonts]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const video = videoSrc ? videoRef.current : null;
    const live = liveDef ? { def: liveDef, names, eventDate, namesColour, fonts } : null;
    const gen = generated ? { style: generated, names, eventDate, fonts } : null;
    let raf = 0;
    let drawn = false;
    let stopped = false;
    const frame = () => {
      // Hold the last frame while the next video loads, rather than flashing black.
      if (drawn && video && video.readyState < 2) {
        raf = requestAnimationFrame(frame);
        return;
      }
      drawn = true;
      drawFloor(ctx, {
        width: px.width,
        height: px.height,
        video,
        live,
        generated: gen,
        message,
        gridTilePx: grid ? portalConfig.floor.tilePx : null,
      });
      if (video || gen) raf = requestAnimationFrame(frame);
    };
    frame();
    // A still floor is drawn once, so draw it again when its fonts arrive.
    if (live && !video && !gen) {
      void Promise.all(fontsToLoad(live.def, fonts).map((f) => document.fonts.load(f))).then(() => {
        if (!stopped) frame();
      });
    }
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [px.width, px.height, videoSrc, liveDef, generated, names, eventDate, namesColour, fonts, message, grid]);

  const plan = reactionsFor(design, phase);
  const dancingNote = phase === 'dancing' && design.dancingMode === 'different';
  const picked = plan.ids.map(findEffect).filter((e): e is EffectDef => !!e);
  const [reactionTurn, setReactionTurn] = useState(0);
  const reaction = picked.length ? picked[reactionTurn % picked.length] : null;
  const ratio = px.width / px.height;

  return (
    <Section
      title={
        <>
          Floor <Accent>preview</Accent>
        </>
      }
      intro={
        booking.floor
          ? "This is your dance floor at its exact size. The reactions are recordings from Stomp's floor, with someone walking across it."
          : booking.floorSqm != null
            ? `This booking lists ${booking.floorSqm} sqm. That is not a floor size the portal can draw yet, so this is a ${SAMPLE_FLOOR.widthM}m x ${SAMPLE_FLOOR.lengthM}m sample. It is not your floor.`
            : `Your floor size is not on this booking yet, so this is a ${SAMPLE_FLOOR.widthM}m x ${SAMPLE_FLOOR.lengthM}m sample. It is not your floor.`
      }
    >
      <div className="toolbar">
        <PhaseSwitch value={phase} onChange={onPhaseChange} label="Preview phase" />
        <label className="check">
          <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} /> Show tile grid
        </label>
      </div>

      <div
        className="floor-frame"
        style={{ aspectRatio: `${px.width} / ${px.height}`, width: `min(100%, calc(62vh * ${ratio}))` }}
      >
        {/* Kept on screen under the canvas, because browsers pause muted videos they consider hidden */}
        {videoSrc && (
          <video
            key={videoSrc}
            ref={videoRef}
            className="floor-video"
            src={videoSrc}
            poster={style?.poster ?? clip?.poster}
            autoPlay
            muted
            loop
            playsInline
            aria-hidden
          />
        )}
        <canvas
          ref={canvasRef}
          width={px.width}
          height={px.height}
          className="floor-canvas"
          data-phase={phase}
          aria-label={
            holding
              ? `${phaseLabel(phase)} holding screen preview`
              : playlist
                ? `${phaseLabel(phase)} assorted colourful videos preview`
                : dancingNote
                  ? `${phaseLabel(phase)} different design preview`
                  : `${phaseLabel(phase)} blank floor preview`
          }
        />
        {reaction && (
          <video
            key={reaction.id}
            className={reaction.fillsFloor ? 'reaction-video fills' : 'reaction-video'}
            src={reaction.video}
            autoPlay
            muted
            loop={picked.length === 1}
            playsInline
            onEnded={() => setReactionTurn((t) => t + 1)}
            aria-hidden
          />
        )}
        {reaction && <span className="preview-chip">Shown with people walking across it</span>}
      </div>

      <p className="floor-meta">
        {booking.floor ? (
          <>
            <strong>
              {px.width} x {px.height} px
            </strong>{' '}
            <span className="muted">
              {booking.floor.widthM}m x {booking.floor.lengthM}m, {px.tilesX} x {px.tilesY} tiles
            </span>
          </>
        ) : (
          <span className="muted">
            Sample preview, {SAMPLE_FLOOR.widthM}m x {SAMPLE_FLOOR.lengthM}m. It is not your floor.
          </span>
        )}
      </p>
      {generated ? (
        <p className="muted small center">
          Made from your invite{generated.noteCues.length ? ' and styling note' : ''}, with the date from your
          booking.{generated.inverted ? ' Your invite is light, so it is flipped to a dark floor with light lettering.' : ''}{' '}
          Stomp will refine the finished version.
        </p>
      ) : style ? (
        <p className="muted small center">
          Your names on the {style.name} style{style.live.date ? ', with the date from your booking' : ''}. Stomp will
          make the finished version{style.usesPhoto ? ' with your photo' : ''}.
        </p>
      ) : plainNames ? (
        <p className="muted small center">Your names on a plain floor for now. Once you pick a style, it shows here.</p>
      ) : clip ? (
        <p className="muted small center">
          Assorted colourful videos, now showing {clip.name}. They change from one to the next through the dancing.
        </p>
      ) : dancingNote ? (
        <p className="muted small center">
          {(design.dancingNote ?? '').trim()
            ? 'Stomp will follow your note for a different design while people dance.'
            : 'Describe what you have in mind, and Stomp will follow that for dancing time.'}
        </p>
      ) : null}
      {reaction && (
        <p className="muted small center">
          {plan.assorted
            ? `Assorted reactions, now showing ${reaction.name}. They take turns while people dance.`
            : picked.length > 1
              ? `Your reactions take turns, now showing ${reaction.name}.`
              : `Showing ${reaction.name}.`}
          {reaction.fillsFloor && holding ? ' It brings its own scene, so it covers the design while it plays.' : ''}{' '}
          The preview shows people walking across the floor, not how it looks when nobody's on it.
        </p>
      )}
      {!reaction && !playlist && !dancingNote && (
        <p className="muted small center">No reactions picked, so the floor won't react when people walk on it. You can add some in the reactions step.</p>
      )}
    </Section>
  );
}

/** Counts up every few seconds while active, to step through the colourful videos. */
function useRotation(active: boolean, seconds: number): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setN((x) => x + 1), seconds * 1000);
    return () => window.clearInterval(t);
  }, [active, seconds]);
  return n;
}
