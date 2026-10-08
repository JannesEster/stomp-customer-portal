import { describe, expect, it } from 'vitest';
import { formatStyleDate, namesLines, splitNames } from './liveText';
import { holdingStylesConfig, type NamesSlotDef } from '../config';

const slot = (over: Partial<NamesSlotDef>): NamesSlotDef => ({
  layout: 'line',
  x: 0.5,
  y: 0.5,
  size: 0.1,
  font: 'cormorant',
  colour: '#fff',
  maxWidth: 0.8,
  ...over,
});

describe('splitNames', () => {
  it('splits on &, and, or +', () => {
    expect(splitNames('Sam & Alex')).toEqual(['Sam', 'Alex']);
    expect(splitNames('Tyla and Jakob')).toEqual(['Tyla', 'Jakob']);
    expect(splitNames('Sam+Alex')).toEqual(['Sam', 'Alex']);
  });

  it('does not split names that only contain "and"', () => {
    expect(splitNames('Alexander & Sandra')).toEqual(['Alexander', 'Sandra']);
    expect(splitNames('Andrew')).toBeNull();
  });
});

describe('namesLines', () => {
  const text = (lines: ReturnType<typeof namesLines>) => lines.map((l) => l.text);

  it('keeps the names as typed on one line, with the suffix', () => {
    expect(text(namesLines('Tyla and Jakob', slot({ suffix: "'s" })))).toEqual(["Tyla and Jakob's"]);
  });

  it('stacks the names around the style connector', () => {
    const lines = namesLines('Tyla & Jakob', slot({ layout: 'stacked', connector: 'and', uppercase: true }));
    expect(lines).toEqual([
      { text: 'TYLA', connector: false },
      { text: 'and', connector: true },
      { text: 'JAKOB', connector: false },
    ]);
  });

  it('splits over two lines', () => {
    expect(text(namesLines('Gerri & Marshall', slot({ layout: 'twoLines', suffix: "'s" })))).toEqual([
      'Gerri &',
      "Marshall's",
    ]);
  });

  it('makes initials', () => {
    expect(text(namesLines('sam and alex', slot({ layout: 'initials' })))).toEqual(['S & A']);
    expect(text(namesLines('Tyla & Jakob', slot({ layout: 'firstInitial' })))).toEqual(['T']);
    expect(text(namesLines('Tyla & Jakob', slot({ layout: 'secondInitial' })))).toEqual(['J']);
    expect(namesLines('Tyla', slot({ layout: 'secondInitial' }))).toEqual([]);
  });

  it('falls back to one line when there is only one name, and nothing when empty', () => {
    expect(text(namesLines('Sam', slot({ layout: 'stacked' })))).toEqual(['Sam']);
    expect(namesLines('  ', slot({}))).toEqual([]);
  });
});

describe('formatStyleDate', () => {
  it('writes the booking date the way each style does', () => {
    expect(formatStyleDate('2027-03-13', 'D MMMM YYYY')).toBe('13 March 2027');
    expect(formatStyleDate('2027-03-13', 'DD - MM - YYYY')).toBe('13 - 03 - 2027');
    expect(formatStyleDate('2027-03-05', 'D - M - YYYY')).toBe('5 - 3 - 2027');
    expect(formatStyleDate('2027-11-06', 'DD.MM.YYYY')).toBe('06.11.2027');
    expect(formatStyleDate('2027-03-13', 'MMMM DTH YYYY')).toBe('March 13TH 2027');
    expect(formatStyleDate('2027-03-13', 'WEEKDAY')).toBe('Saturday');
    expect(formatStyleDate('2027-03-11', 'DTH')).toBe('11TH');
    expect(formatStyleDate('2027-03-02', 'DTH')).toBe('2ND');
  });
});

describe('holding style live text config', () => {
  it('only uses fonts that are in the fonts map', () => {
    const fonts = holdingStylesConfig.fonts;
    for (const s of holdingStylesConfig.styles) {
      const slots = [s.live.names, ...(s.live.date ? [s.live.date] : []), ...(s.live.fixed ?? [])];
      for (const slot of slots) expect(fonts[slot.font], `${s.id} ${slot.font}`).toBeDefined();
      if (s.live.names.connectorFont) expect(fonts[s.live.names.connectorFont]).toBeDefined();
    }
  });

  it('uses the clean video on the floor and the sample in the gallery', () => {
    for (const s of holdingStylesConfig.styles) {
      expect(s.video).toMatch(/^\/templates\/clean\//);
      expect(s.sampleVideo).toMatch(/^\/templates\/floor-\d+\.mp4$/);
    }
  });
});
