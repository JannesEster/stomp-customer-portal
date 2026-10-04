import { useRef, useState } from 'react';
import { portalConfig, templatesConfig } from '../config';
import { acceptAttr, defaultHoldingDesign, validateUpload } from '../lib/design';
import { useFileUrl } from '../hooks/useFileUrl';
import { useServices } from '../services';
import type { UpdateDesign } from '../hooks/useDesignState';
import type { Booking, DesignState, HoldingDesign, Phase } from '../types';
import { Accent, PhaseSwitch, Section, fileStillUsed, phaseLabel } from './common';
import { InviteUpload } from './InviteUpload';

export function HoldingSection({
  booking,
  design,
  update,
  phase,
  onPhaseChange,
}: {
  booking: Booking;
  design: DesignState;
  update: UpdateDesign;
  phase: Phase;
  onPhaseChange: (p: Phase) => void;
}) {
  const { storage } = useServices();
  const editPhase: Phase = design.separatePostBridal ? phase : 'pre';
  const h = design.holding[editPhase];
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const photoUrl = useFileUrl(h.photo.file);

  const set = (patch: Partial<HoldingDesign>) =>
    update((d) => ({
      ...d,
      holding: { ...d.holding, [editPhase]: { ...d.holding[editPhase], ...patch } },
    }));

  const setPhoto = (patch: Partial<HoldingDesign['photo']>) => set({ photo: { ...h.photo, ...patch } });

  const toggleSeparate = (on: boolean) =>
    update((d) => {
      const postUntouched =
        JSON.stringify(d.holding.post) === JSON.stringify(defaultHoldingDesign(booking));
      const post = on && postUntouched ? structuredClone(d.holding.pre) : d.holding.post;
      return { ...d, separatePostBridal: on, holding: { ...d.holding, post } };
    });

  const releasePhoto = (fileId: string) => {
    if (!fileStillUsed(design, fileId, editPhase)) void storage.deleteFile(fileId);
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    const error = validateUpload(file, portalConfig.uploads.holdingPhoto);
    setPhotoError(error);
    if (error) return;
    const stored = await storage.saveFile(file);
    if (h.photo.file) releasePhoto(h.photo.file.id);
    setPhoto({ file: stored, zoom: 1, posX: 50, posY: 50 });
  };

  const removePhoto = () => {
    if (h.photo.file) releasePhoto(h.photo.file.id);
    setPhoto({ file: null, zoom: 1, posX: 50, posY: 50 });
  };

  return (
    <Section
      title={
        <>
          Holding <Accent>screen</Accent>
        </>
      }
      intro="This is the design on the floor while guests walk in. Most couples use their names and a photo, like a close up of their hands."
    >
      <label className="check toggle-row">
        <input
          type="checkbox"
          checked={design.separatePostBridal}
          onChange={(e) => toggleSeparate(e.target.checked)}
        />{' '}
        Use a different design after the bridal entrance
      </label>

      {design.separatePostBridal ? (
        <div className="toolbar">
          <span className="muted small">Editing:</span>
          <PhaseSwitch value={phase} onChange={onPhaseChange} label="Holding screen to edit" />
        </div>
      ) : (
        <p className="muted small">One design is used before and after the bridal entrance.</p>
      )}

      <div className="two-col">
        <div className="builder">
          {design.separatePostBridal && <h3>{phaseLabel(editPhase)} design</h3>}

          <fieldset>
            <legend>Template</legend>
            <div className="choice-grid">
              {templatesConfig.templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={h.templateId === t.id ? 'choice active' : 'choice'}
                  aria-pressed={h.templateId === t.id}
                  onClick={() => set({ templateId: t.id })}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="field">
            <span>Your names</span>
            <input type="text" value={h.names} onChange={(e) => set({ names: e.target.value })} />
          </label>

          <label className="field">
            <span>Second line (optional)</span>
            <input
              type="text"
              value={h.secondLine}
              placeholder="For example, your wedding date"
              onChange={(e) => set({ secondLine: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Font</span>
            <select value={h.fontId} onChange={(e) => set({ fontId: e.target.value })}>
              {templatesConfig.fonts.map((f) => (
                <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          <div className="colour-row">
            <ColourField label="Text" value={h.textColour} onChange={(v) => set({ textColour: v })} />
            <ColourField label="Background" value={h.backgroundColour} onChange={(v) => set({ backgroundColour: v })} />
            <ColourField label="Accent" value={h.accentColour} onChange={(v) => set({ accentColour: v })} />
          </div>

          <fieldset>
            <legend>Photo</legend>
            {h.photo.file && photoUrl ? (
              <div className="photo-edit">
                <img className="thumb" src={photoUrl} alt="Holding screen photo" />
                <div className="sliders">
                  <Slider label="Zoom" min={1} max={3} step={0.05} value={h.photo.zoom} onChange={(v) => setPhoto({ zoom: v })} />
                  <Slider label="Left and right" min={0} max={100} step={1} value={h.photo.posX} onChange={(v) => setPhoto({ posX: v })} />
                  <Slider label="Up and down" min={0} max={100} step={1} value={h.photo.posY} onChange={(v) => setPhoto({ posY: v })} />
                </div>
              </div>
            ) : (
              <p className="muted small">No photo yet.</p>
            )}
            <div className="row">
              <button type="button" className="secondary" onClick={() => photoInput.current?.click()}>
                {h.photo.file ? 'Replace photo' : 'Upload photo'}
              </button>
              {h.photo.file && (
                <button type="button" className="link" onClick={removePhoto}>
                  Remove photo
                </button>
              )}
            </div>
            <input
              ref={photoInput}
              type="file"
              hidden
              accept={acceptAttr(portalConfig.uploads.holdingPhoto)}
              onChange={(e) => {
                void onPhoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            {photoError && <p className="error">{photoError}</p>}
            {findTemplateHasNoPhoto(h.templateId) && h.photo.file && (
              <p className="muted small">The Names only template doesn't show a photo.</p>
            )}
          </fieldset>
        </div>

        <InviteUpload design={design} update={update} />
      </div>
    </Section>
  );
}

function findTemplateHasNoPhoto(id: string): boolean {
  return templatesConfig.templates.find((t) => t.id === id)?.photo === null;
}

function ColourField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="colour">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <span>{label}</span>
    </label>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
