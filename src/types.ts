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
  /** ISO date, YYYY-MM-DD. Empty when the booking has no date. */
  eventDate: string;
  venue: string;
  /** Street address when the booking has one. Seeded demos omit this. */
  address?: string | null;
  /** Package name when the booking has one. Seeded demos omit this. */
  packageName?: string | null;
  /**
   * Width and length when known. Null when Airtable has no sqm, or a sqm other than 12 or 27.
   * Do not invent a size for the other areas.
   */
  floor: { widthM: number; lengthM: number } | null;
  /** Square metres from Airtable. Seeded demos omit this. */
  floorSqm?: number | null;
  /** Null when portrait screens could not be inferred. Zero means none booked. */
  screensBooked: number | null;
  /** Extra ids, matching src/config/extras.json, or an add-on name when it is not a known extra. */
  extras: string[];
  /**
   * Supplier names from the booking, when those columns are present.
   * The couple edits the same names on the design. Empty when the booking has none.
   */
  weddingPlanner?: string;
  photographer?: string;
  videographer?: string;
  dj?: string;
  otherSuppliers?: string;
}

/** People helping on the day. The couple types these, and they map to the booking fields of the same names. */
export interface SupplierDetails {
  weddingPlanner: string;
  photographer: string;
  videographer: string;
  dj: string;
  otherSuppliers: string;
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

export type ScreenMode = 'design' | 'photos';

/** What the portrait screens show. Their photos and videos are in `DesignState.media`, by timing. */
export interface ScreensDesign {
  /** Style id from src/config/screen-styles.json, null until chosen */
  styleId: string | null;
  modes: Record<Phase, ScreenMode>;
  /** What the couple wants written on the screens: welcome wording, a menu, a photo slideshow, and so on */
  note: string;
}

export type DesignStatus = 'draft' | 'submitted';

export interface DesignState extends SupplierDetails {
  version: 3;
  status: DesignStatus;
  updatedAt: string;
  submittedAt: string | null;
  /** `after` is only used when its mode is 'different' */
  designs: Record<Phase, HoldingDesign>;
  afterMode: AfterEntranceMode;
  dancingMode: DancingMode;
  /** What the couple has in mind when dancing time uses a different design */
  dancingNote: string;
  /** 24 hour HH:MM, or empty until the couple sets it. When the floor and screens change. */
  entranceTime: string;
  dancingStarts: string;
  /** True after a submit that left either night time blank. Cleared by a later submit that includes both. */
  submittedWithoutTimes: boolean;
  /** Chosen before the bridal entrance and kept after it. Dancing time uses an assortment instead. */
  reactions: string[];
  /** Used after the entrance only when nothing was picked before it. */
  afterReactions: string[];
  media: MediaItem[];
  screens: ScreensDesign;
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
  /** Another generated version, for after the entrance. Chosen with INVITE_AFTER_STYLE_ID */
  afterInviteStyle: GeneratedStyle | null;
  stylingNote: string;
  /** Only meaningful when the booking does not already include live content */
  liveContentRequested: boolean;
  /**
   * Steps the couple has engaged with. A step is added when they change a choice on it,
   * or leave it forwards. Untouched defaults stay out of this list.
   */
  confirmedSteps: string[];
}
