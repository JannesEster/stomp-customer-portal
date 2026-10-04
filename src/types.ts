export type Phase = 'holding' | 'after' | 'dancing';
export type Timing = 'start' | 'middle' | 'end';
export type MediaKind = 'image' | 'video';

export interface Customer {
  id: string;
  name: string;
  email: string;
  bookingIds: string[];
}

export interface Booking {
  id: string;
  customerId: string;
  coupleNames: string;
  /** ISO date, YYYY-MM-DD */
  eventDate: string;
  venue: string;
  floor: { widthM: number; lengthM: number };
  screensBooked: number;
  /** Extra ids, matching src/config/extras.json */
  extras: string[];
}

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
}

export interface MediaItem {
  id: string;
  file: StoredFile;
  kind: MediaKind;
  timing: Timing;
  addedAt: string;
}

export interface HoldingDesign {
  /** Style id from src/config/holding-styles.json, null until chosen */
  styleId: string | null;
  names: string;
  /** A photo or video of the couple */
  media: StoredFile | null;
}

export type AfterEntranceMode = 'same' | 'different';

export type InviteTypography = 'modern' | 'classic' | 'romantic' | 'boho' | 'deco';
export type InviteLayout = 'monogram' | 'stacked' | 'frame' | 'minimal';

/** A holding screen design generated from the couple's invite colours and styling note. */
export interface GeneratedStyle {
  variant: number;
  typography: InviteTypography;
  layout: InviteLayout;
  background: string;
  text: string;
  accent: string;
  /** True when a light invite was flipped to a dark floor with light lettering */
  inverted: boolean;
  /** Words from the styling note that shaped the design */
  noteCues: string[];
  /** What it was generated from, so a changed invite or note starts again from the best match */
  basedOn: string;
}
export type DancingMode = 'blank' | 'videos' | 'different';

export type DesignStatus = 'draft' | 'submitted';

export interface DesignState {
  version: 3;
  status: DesignStatus;
  updatedAt: string;
  submittedAt: string | null;
  /** `after` and `dancing` are only used when their mode is 'different' */
  designs: Record<Phase, HoldingDesign>;
  afterMode: AfterEntranceMode;
  dancingMode: DancingMode;
  /** Chosen during the holding screen and kept after the entrance. Dancing time uses an assortment instead. */
  reactions: string[];
  media: MediaItem[];
  invite: StoredFile | null;
  /** First page of a PDF invite as an image, for the thumbnail */
  invitePreview: StoredFile | null;
  /** Main colours picked out of the invite, most characteristic first */
  invitePalette: string[];
  /** The invite colour to use for the names, chosen to be readable on the floor */
  inviteNamesColour: string | null;
  /** The invite's paper colour */
  invitePaper: string | null;
  /** Chosen by setting a design's styleId to INVITE_STYLE_ID */
  inviteStyle: GeneratedStyle | null;
  stylingNote: string;
  /** Only meaningful when the booking does not already include live content */
  liveContentRequested: boolean;
}
