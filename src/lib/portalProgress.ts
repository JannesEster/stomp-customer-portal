import { findEffect, findScreenStyle, findStyle } from '../config';
import { stepsFor, type StepDef } from '../design/steps';
import { screenCount } from './dimensions';
import { holdingStyleChosen, isStepComplete, mediaFor } from './design';
import { generatedFor, LAYOUT_LABELS, TYPOGRAPHY_LABELS } from './inviteStyle';
import type { DesignState, HoldingDesign, Phase } from '../types';

export interface PortalStepReport {
  total: number;
  complete: number;
  /** 0 to 1, for an Airtable percent field. */
  progress: number;
  /** Human step names still to finish. Empty when every applicable step is done. */
  missing: string[];
}

/**
 * Progress over the steps this booking actually shows.
 * A step counts only after the couple has confirmed it and it meets its completion rule.
 * Untouched defaults do not count. Hidden steps, such as the screen steps when no screens
 * are booked, are left out of the total.
 */
export function portalStepReport(design: DesignState, screensBooked: number | null): PortalStepReport {
  const steps = applicableSteps(design, screensBooked);
  const missing = steps.filter((step) => !stepDone(step.id, design)).map((step) => step.name);
  const complete = steps.length - missing.length;
  const progress = steps.length === 0 ? 0 : Math.round((complete / steps.length) * 10000) / 10000;
  return { total: steps.length, complete, progress, missing };
}

function stepDone(stepId: StepDef['id'], design: DesignState): boolean {
  return design.confirmedSteps.includes(stepId) && isStepComplete(stepId, design);
}

/** One plain-English line per applicable step, plus the floor design name. No JSON. */
export function portalSummary(design: DesignState, screensBooked: number | null): string {
  const lines = applicableSteps(design, screensBooked).map((step) => `${summaryLabel(step)}: ${stepLine(step, design)}`);
  lines.push(`Floor design: ${floorDesignLabel(design)}`);
  const people = supplierLines(design);
  if (people) {
    lines.push('');
    lines.push('People on the day');
    lines.push(people);
  }
  return lines.join('\n');
}

const SUPPLIER_LINES_MAX = 2_500;

const SUPPLIER_LINE_ROLES = [
  ['weddingPlanner', 'Wedding planner'],
  ['photographer', 'Photographer'],
  ['videographer', 'Videographer'],
  ['dj', 'DJ'],
  ['otherSuppliers', 'Other'],
] as const;

/**
 * One line per supplier role the couple filled in.
 * Empty roles are left out. Other keeps its line breaks. The whole text stays within 2,500 characters.
 */
export function supplierLines(design: DesignState): string {
  const lines: string[] = [];
  for (const [key, label] of SUPPLIER_LINE_ROLES) {
    const value = (design[key] ?? '').trim();
    if (!value) continue;
    lines.push(`${label}: ${value}`);
  }
  const text = lines.join('\n');
  if (text.length <= SUPPLIER_LINES_MAX) return text;
  return `${text.slice(0, SUPPLIER_LINES_MAX - 1)}…`;
}

/** Single line name of the floor preview the couple chose, including the main options. */
export function floorDesignLabel(design: DesignState): string {
  const holding = holdingPhrase(design, design.designs.holding);
  const after =
    design.afterMode === 'same'
      ? 'Keeps the holding screen after the entrance'
      : `After the entrance: ${holdingPhrase(design, design.designs.after)}`;
  const dancing = dancingPhrase(design);
  return clip(`${holding}. ${after}. Dancing time: ${dancing}.`, 500);
}

function applicableSteps(design: DesignState, screensBooked: number | null): StepDef[] {
  return stepsFor(screenCount(screensBooked), design.reactions.length === 0);
}

/** Short labels match the step list. Screen steps use the full name so they don't collide with the floor steps. */
function summaryLabel(step: StepDef): string {
  return step.group === 'screens' ? step.name : step.short;
}

function stepLine(step: StepDef, design: DesignState): string {
  if (!design.confirmedSteps.includes(step.id)) return 'Not looked at yet';
  if (keptDefault(step.id, design)) return 'Default kept';
  switch (step.id) {
    case 'details': {
      const names = design.designs.holding.names.trim();
      return names ? clip(names, 120) : 'not set yet';
    }
    case 'floor-design':
      return holdingPhrase(design, design.designs.holding);
    case 'floor-reactions':
      return reactionPhrase(design.reactions);
    case 'floor-after':
      if (design.afterMode === 'same') return 'Keeps the holding screen';
      return holdingStyleChosen(design, design.designs.after)
        ? holdingPhrase(design, design.designs.after)
        : 'not set yet';
    case 'floor-after-reactions':
      return reactionPhrase(design.afterReactions);
    case 'floor-dancing':
      return dancingPhrase(design);
    case 'screens-design':
      return findScreenStyle(design.screens.styleId)?.name ?? 'not set yet';
    case 'screens-holding':
      return screenPartPhrase(design, 'holding');
    case 'screens-after':
      return screenPartPhrase(design, 'after');
    case 'screens-dancing':
      return screenPartPhrase(design, 'dancing');
    case 'review':
      return design.status === 'submitted' ? 'Submitted' : 'Still a draft';
    default:
      return 'not set yet';
  }
}

/** True when the couple confirmed a step without changing its starting choice. */
function keptDefault(stepId: StepDef['id'], design: DesignState): boolean {
  const holding = design.designs.holding;
  switch (stepId) {
    case 'details':
      return (
        holding.names.trim().length > 0 &&
        holding.names === design.designs.after.names &&
        holding.names === design.designs.dancing.names
      );
    case 'floor-design':
      return (
        holding.styleId == null &&
        holding.media == null &&
        !design.invite &&
        !design.inviteStyle &&
        !design.stylingNote
      );
    case 'floor-reactions':
      return design.reactions.length === 0;
    case 'floor-after':
      return design.afterMode === 'same';
    case 'floor-after-reactions':
      return design.afterReactions.length === 0;
    case 'floor-dancing':
      return design.dancingMode === 'blank' && design.dancingNote.trim() === '';
    case 'screens-design':
      return design.screens.styleId == null;
    case 'screens-holding':
      return design.screens.modes.holding === 'design' && mediaFor(design, 'holding').length === 0;
    case 'screens-after':
      return design.screens.modes.after === 'design' && mediaFor(design, 'after').length === 0;
    case 'screens-dancing':
      return design.screens.modes.dancing === 'design' && mediaFor(design, 'dancing').length === 0;
    case 'review':
      return design.status === 'draft' && !design.liveContentRequested;
    default:
      return false;
  }
}

function holdingPhrase(design: DesignState, holding: HoldingDesign): string {
  const photo = holding.media ? 'photo uploaded' : 'no photo yet';
  const generated = generatedFor(design, holding.styleId);
  if (generated) {
    return clip(
      `From your invite, ${TYPOGRAPHY_LABELS[generated.typography]}, ${LAYOUT_LABELS[generated.layout]}, ${photo}`,
      240,
    );
  }
  const style = findStyle(holding.styleId);
  if (!style) return 'not set yet';
  return `${style.name}, ${photo}`;
}

function reactionPhrase(ids: string[]): string {
  if (!ids.length) return 'None picked';
  const names = ids.map((id) => findEffect(id)?.name).filter((name): name is string => !!name);
  return names.length ? clip(names.join(', '), 240) : 'None picked';
}

function dancingPhrase(design: DesignState): string {
  if (design.dancingMode === 'blank') return 'Blank floor with assorted reactions';
  if (design.dancingMode === 'videos') return 'Assorted colourful videos';
  const note = design.dancingNote.trim();
  return note ? clip(note, 400) : 'not set yet';
}

function screenPartPhrase(design: DesignState, phase: Phase): string {
  if (design.screens.modes[phase] === 'photos') {
    const count = mediaFor(design, phase).length;
    if (!count) return 'not set yet';
    return count === 1 ? '1 photo or video' : `${count} photos or videos`;
  }
  return findScreenStyle(design.screens.styleId) ? 'Your screen design' : 'not set yet';
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}
