import type { DesignState } from '../types';

/**
 * Copy notes that only existed in this browser into the saved design, once.
 * Server notes win. A design that already has notes is left alone.
 */
export function migrateLegacyNotes(
  design: DesignState,
  legacy: string | null | undefined,
  serverNotes: string | null | undefined,
): { design: DesignState; migrated: boolean } {
  const oldNotes = (legacy ?? '').trim();
  const saved = (serverNotes ?? '').trim();
  const current = (design.notes ?? '').trim();
  if (!oldNotes || saved || current) return { design, migrated: false };
  return { design: { ...design, notes: oldNotes }, migrated: true };
}
