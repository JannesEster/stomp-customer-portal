/**
 * The only floor areas whose width and length are known.
 * 4m x 3m is 12 sqm. 6m x 4.5m is 27 sqm. Other areas stay unset.
 */
export const KNOWN_FLOORS = [
  { sqm: 12, widthM: 4, lengthM: 3 },
  { sqm: 27, widthM: 6, lengthM: 4.5 },
] as const;

/**
 * Canvas size when a booking has no known width and length.
 * The preview must say this is a sample. It is not the customer's floor.
 */
export const SAMPLE_FLOOR = { widthM: 6, lengthM: 4.5 } as const;
