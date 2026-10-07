import type { ReactNode } from 'react';
import type { Phase } from '../types';
import { Accent } from './common';

export type StepId =
  | 'details'
  | 'floor-design'
  | 'floor-reactions'
  | 'floor-after'
  | 'floor-dancing'
  | 'screens-design'
  | 'screens-holding'
  | 'screens-after'
  | 'screens-dancing'
  | 'review';

export type StepGroup = 'floor' | 'screens' | 'finish';

export interface StepDef {
  id: StepId;
  group: StepGroup;
  /** Plain text, for the Next button */
  name: string;
  /** Shown under its group in the step list, and in the Next button on phones */
  short: string;
  title: ReactNode;
  intro: string;
  preview: 'floor' | 'screens' | null;
  /** The part of the night the step is about, and where its preview starts */
  phase: Phase;
}

export const STEP_GROUPS: { id: StepGroup; label: string }[] = [
  { id: 'floor', label: 'Floor' },
  { id: 'screens', label: 'Screens' },
  { id: 'finish', label: 'Finish' },
];

const STEPS: StepDef[] = [
  {
    id: 'details',
    group: 'floor',
    name: 'Your details',
    short: 'Your details',
    title: (
      <>
        Your <Accent>details</Accent>
      </>
    ),
    intro: "Let's start with the two of you. Your names go on your holding screen, and you can see them on the floor below.",
    preview: 'floor',
    phase: 'holding',
  },
  {
    id: 'floor-design',
    group: 'floor',
    name: 'Your holding screen',
    short: 'Holding screen',
    title: (
      <>
        Your holding <Accent>screen</Accent>
      </>
    ),
    intro:
      'This is on the floor while guests arrive, before the bridal entrance. Pick a style, add a photo of the two of you, or upload your invite or styling and generate a design from it.',
    preview: 'floor',
    phase: 'holding',
  },
  {
    id: 'floor-reactions',
    group: 'floor',
    name: 'Floor reactions',
    short: 'Reactions',
    title: (
      <>
        Floor <Accent>reactions</Accent>
      </>
    ),
    intro:
      "Pick what happens when guests walk across your holding screen. They carry on after the bridal entrance, and if you pick a few they take turns. These are recordings from Stomp's floor, so hover or tap one to see it move.",
    preview: 'floor',
    phase: 'holding',
  },
  {
    id: 'floor-after',
    group: 'floor',
    name: 'After the bridal entrance',
    short: 'After the entrance',
    title: (
      <>
        After the bridal <Accent>entrance</Accent>
      </>
    ),
    intro: "Once you've made your entrance, what should the floor show until the dancing starts?",
    preview: 'floor',
    phase: 'after',
  },
  {
    id: 'floor-dancing',
    group: 'floor',
    name: 'Dancing time',
    short: 'Dancing time',
    title: (
      <>
        Dancing <Accent>time</Accent>
      </>
    ),
    intro: 'When the dancing starts, what should the floor show?',
    preview: 'floor',
    phase: 'dancing',
  },
  {
    id: 'screens-design',
    group: 'screens',
    name: 'Your screen design',
    short: 'Screen design',
    title: (
      <>
        Your screen <Accent>design</Accent>
      </>
    ),
    intro:
      'Pick a welcome sign or an order of the day for your portrait screens. The samples show example names. Stomp makes the finished version with your names and date.',
    preview: 'screens',
    phase: 'holding',
  },
  {
    id: 'screens-holding',
    group: 'screens',
    name: 'Screens before the entrance',
    short: 'Before the entrance',
    title: (
      <>
        Screens before the <Accent>entrance</Accent>
      </>
    ),
    intro: 'What should your screens show while guests arrive, before the bridal entrance?',
    preview: 'screens',
    phase: 'holding',
  },
  {
    id: 'screens-after',
    group: 'screens',
    name: 'Screens after the entrance',
    short: 'After the entrance',
    title: (
      <>
        Screens after the <Accent>entrance</Accent>
      </>
    ),
    intro: "Once you've made your entrance, what should your screens show until the dancing starts?",
    preview: 'screens',
    phase: 'after',
  },
  {
    id: 'screens-dancing',
    group: 'screens',
    name: 'Screens during the dancing',
    short: 'During the dancing',
    title: (
      <>
        Screens during the <Accent>dancing</Accent>
      </>
    ),
    intro: 'When the dancing starts, what should your screens show?',
    preview: 'screens',
    phase: 'dancing',
  },
  {
    id: 'review',
    group: 'finish',
    name: 'Review and submit',
    short: 'Review and submit',
    title: (
      <>
        Review and <Accent>submit</Accent>
      </>
    ),
    intro:
      "Have a last look over your plan, then send it to Stomp. You can still make changes after you submit. Just submit again so Stomp has the latest.",
    preview: null,
    phase: 'holding',
  },
];

/** Bookings without portrait screens skip the screens steps. */
export function stepsFor(screens: number): StepDef[] {
  return screens > 0 ? STEPS : STEPS.filter((s) => s.group !== 'screens');
}
