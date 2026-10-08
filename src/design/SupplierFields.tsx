import type { UpdateDesign } from '../hooks/useDesignState';
import type { DesignState, SupplierDetails } from '../types';

const LINES: { key: keyof SupplierDetails; label: string }[] = [
  { key: 'weddingPlanner', label: 'Wedding planner' },
  { key: 'photographer', label: 'Photographer' },
  { key: 'videographer', label: 'Videographer' },
  { key: 'dj', label: 'DJ' },
];

/** Wedding planner, photographer, videographer, DJ, and a larger box for anyone else. */
export function SupplierFields({ design, update }: { design: DesignState; update: UpdateDesign }) {
  const set = (key: keyof SupplierDetails, value: string) => update((d) => ({ ...d, [key]: value }));

  return (
    <div className="supplier-fields">
      <h3>People on the day</h3>
      <p className="muted small">
        Add a wedding planner, photographer, videographer, DJ, or anyone else. You can update these on Your details
        and on My bookings.
      </p>
      {LINES.map((line) => (
        <label className="field" key={line.key}>
          <span>{line.label}</span>
          <input
            type="text"
            value={design[line.key] ?? ''}
            onChange={(e) => set(line.key, e.target.value)}
          />
        </label>
      ))}
      <label className="field">
        <span>Other</span>
        <textarea
          className="supplier-other"
          value={design.otherSuppliers ?? ''}
          placeholder="Celebrant, florist, a separate MC, or anyone else we should know about"
          onChange={(e) => set('otherSuppliers', e.target.value)}
        />
      </label>
    </div>
  );
}
