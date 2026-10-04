import { useEffect, useRef, useState } from 'react';
import { dancingVideosConfig, findEffect, findStyle, holdingStylesConfig, portalConfig, type EffectDef } from '../config';
import { floorPixels } from '../lib/dimensions';
import { holdingFor, reactionsFor, showsDancingVideos } from '../lib/design';
import { drawFloor } from '../lib/floorRender';
import { fontsToLoad } from '../lib/liveText';
import { generatedFonts } from '../lib/generatedRender';
import { INVITE_STYLE_ID } from '../lib/inviteStyle';
import type { Booking, DesignState, Phase } from '../types';
import { Accent, PhaseSwitch, Section, phaseLabel } from './common';

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
  const generated = holding?.styleId === INVITE_STYLE_ID ? design.inviteStyle : null;
  const style = generated ? undefined : findStyle(holding?.styleId ?? null);
  const [grid, setGrid] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const message = holding && !style && !generated ? 'Choose a style above' : null;
  const playlist = showsDancingVideos(design, phase) ? dancingVideosConfig.videos : null;
  const clipTurn = useRotation(!!playlist, dancingVideosConfig.rotateSeconds);
  const clip = playlist ? playlist[clipTurn % playlist.length] : null;
  const videoSrc = style?.video ?? clip?.src ?? null;
  const names = holding?.names ?? '';
  const namesColour = design.inviteNamesColour;
  const eventDate = booking.eventDate;
  const fonts = holdingStylesConfig.fonts;

  useEffect(() => {
    const list = generated ? generatedFonts(generated, fonts) : style ? fontsToLoad(style.live, fonts) : [];
    for (const f of list) void document.fonts.load(f);
  }, [style, generated, fonts]);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const video = videoSrc ? videoRef.current : null;
    const live = style ? { def: style.live, names, eventDate, namesColour, fonts } : null;
    const gen = generated ? { style: generated, names, eventDate, fonts } : null;
    let raf = 0;
    let drawn = false;
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
    return () => cancelAnimationFrame(raf);
  }, [px.width, px.height, videoSrc, style, generated, names, eventDate, namesColour, fonts, message, grid]);

  const plan = reactionsFor(design, phase);
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
      intro="This is your dance floor at its exact size. The reactions are recordings from Stomp's floor, with someone walking across it."
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
          aria-label={
            holding
              ? `${phaseLabel(phase)} holding screen preview`
              : playlist
                ? `${phaseLabel(phase)} colourful videos preview`
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
      </div>

      <p className="floor-meta">
        <strong>
          {px.width} x {px.height} px
        </strong>{' '}
        <span className="muted">
          {booking.floor.widthM}m x {booking.floor.lengthM}m, {px.tilesX} x {px.tilesY} tiles
        </span>
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
      ) : clip ? (
        <p className="muted small center">
          Colourful videos, now showing {clip.name}. Stomp mixes visuals like these through the dancing.
        </p>
      ) : null}
      {reaction && (
        <p className="muted small center">
          {plan.assorted
            ? `Assorted reactions, now showing ${reaction.name}. They take turns while people dance.`
            : picked.length > 1
              ? `Your reactions take turns, now showing ${reaction.name}.`
              : `Showing ${reaction.name}.`}
          {reaction.fillsFloor && holding ? ' It brings its own scene, so it covers the design while it plays.' : ''}
        </p>
      )}
      {!reaction && !playlist && (
        <p className="muted small center">No reactions picked yet. Choose some in the Holding screen tab.</p>
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
