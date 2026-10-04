export type Phase = 'pre' | 'post';
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

export interface HoldingPhoto {
  file: StoredFile | null;
  /** 1 = cover fit, up to 3 */
  zoom: number;
  /** Focal point in percent, 0 to 100 */
  posX: number;
  posY: number;
}

export interface HoldingDesign {
  templateId: string;
  names: string;
  secondLine: string;
  fontId: string;
  textColour: string;
  backgroundColour: string;
  accentColour: string;
  photo: HoldingPhoto;
}

export type DesignStatus = 'draft' | 'submitted';

export interface DesignState {
  version: 1;
  status: DesignStatus;
  updatedAt: string;
  submittedAt: string | null;
  separatePostBridal: boolean;
  holding: Record<Phase, HoldingDesign>;
  reactions: Record<Phase, string[]>;
  media: MediaItem[];
  invite: StoredFile | null;
  stylingNote: string;
  /** Only meaningful when the booking does not already include live content */
  liveContentRequested: boolean;
}
