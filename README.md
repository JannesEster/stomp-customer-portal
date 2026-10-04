# Stomp Sphere customer portal

A web portal where a booked Stomp Sphere customer plans what appears on their LED dance floor and portrait screens on the night. The **Design** tab is fully built. **My Bookings** and **Notes/Details** are simple placeholders.

Everything runs locally on seed data. There are no live external services, no real customer data, and nothing leaves the browser.

## Setup

Requires Node 20 or newer.

```bash
npm install
npm start          # dev server at http://localhost:5173, opens the Design tab
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm test` | Unit tests (Vitest): floor pixel formula, screen count, live content rules, upload validation, phase logic |
| `npm run typecheck` | TypeScript check |
| `npm run build` | Typecheck and production build to `dist/` |

### Demo bookings

Three seeded customers live in `src/mock/`. Switch between them with the **Demo booking** picker at the bottom of the page, or add `?customer=<id>` to the URL:

| Customer id | Floor | Floor pixels | Screens | Live event streaming |
| --- | --- | --- | --- | --- |
| `cust-sam-alex` (default) | 6m x 4.5m | 1536 x 1152 | 2 | Included |
| `cust-jordan-casey` | 4m x 3m | 1024 x 768 | 1 | Not booked (optional $500) |
| `cust-riley-morgan` | 5m x 4m | 1280 x 1024 | 0 | Not booked |

Editing `src/mock/bookings.json` (floor size, `screensBooked`, `extras`) changes the previews and the live content section with no code change. Each booking's design is saved separately. To start fresh, clear the site data for `localhost:5173` in your browser.

## Architecture

```
src/
  config/          Editable JSON config plus typed loaders (index.ts)
  mock/            Seed customers and bookings
  services/        The three swappable interfaces and their mocks
  lib/             Pure logic: dimensions, canvas renderer, live content rules, validation
  hooks/           useDesignState (load, autosave, submit), useFileUrl, useImage
  design/          Design tab sections
  tabs/            My Bookings, Notes/Details, Design
public/effects/    Placeholder reaction artwork referenced by effects.json
```

Built with React, TypeScript and Vite. No UI or state libraries.

Styling follows stompsphere.com.au: black background, Inter for text, italic Playfair Display with the pink, orange and blue gradient for accent words, and pill buttons. The design tokens are at the top of `src/styles.css`. Both fonts are bundled through `@fontsource`, so the portal makes no font requests to external services. The white Stomp Sphere logo is in `public/brand/`.

- **Floor preview** (`design/FloorPreview.tsx`): a `<canvas>` sized to the exact floor pixels (`width_m x 256` by `length_m x 256` with the default config). `lib/holdingRender.ts` draws the holding screen at full resolution, and CSS scales it to fit while keeping the aspect ratio. The real pixel size is shown under it. A tile grid overlay can be toggled. Reactions are DOM elements over the canvas, spawned on tap, drag or hover, or by **Simulate dancers**. They are sized in tiles, so they scale with the floor.
- **Phases**: the phase switcher drives both the floor preview and, when **Use a different design after the bridal entrance** is on, which holding design is being edited. When it's off, the pre-bridal design is used for both phases (`holdingFor` in `lib/design.ts`). Reactions are always chosen per phase.
- **Screens** (`design/ScreensSection.tsx`): one portrait preview per booked screen, sized from config. They cycle through the uploaded media, filtered by All, Start, Middle or End of night. The section is hidden when the booking has no screens.
- **Saving** (`hooks/useDesignState.ts`): the whole design is one `DesignState` object (`src/types.ts`), autosaved through `StorageProvider` 400 ms after each change and flushed on page hide. **Submit design to Stomp** sets `status: 'submitted'` and shows the summary. Any later edit returns it to draft until it's submitted again.

## The three interfaces

All three are wired up in `src/services/index.tsx` (`defaultServices`). To swap one for a real implementation, change that file only.

### `AuthProvider` (`services/auth.ts`)

```ts
getCurrentCustomer(): Promise<Customer | null>
signOut(): Promise<void>
```

Mock: `MockAuthProvider` always signs in a seeded customer from `mock/customers.json`, chosen by `?customer=`. The demo picker only appears while the mock is in use.

### `BookingSource` (`services/bookings.ts`)

```ts
getBookingsForCustomer(customer: Customer): Promise<Booking[]>
```

Mock: `MockBookingSource` reads `mock/bookings.json`. The portal shows the customer's first booking. Customers can't change floor size or screen count in the portal.

### `StorageProvider` (`services/storage.ts`)

```ts
loadData<T>(key): Promise<T | null>
saveData<T>(key, value): Promise<void>
saveFile(file: File): Promise<StoredFile>
getFileUrl(fileId): Promise<string | null>
deleteFile(fileId): Promise<void>
```

Mock: `LocalStorageProvider` keeps JSON in `localStorage` (keys `stomp-portal:design:<bookingId>` and `stomp-portal:notes:<bookingId>`) and file blobs in IndexedDB (`stomp-portal-files`), because `localStorage` is too small for photos and video. Designs only store file references (`StoredFile`), never file contents.

## Config files (`src/config/`)

| File | Controls |
| --- | --- |
| `portal.json` | `floor.tileSizeMm` and `floor.tilePx` (the pixel formula), screen `widthPx`, `heightPx`, `maxScreens` and `slideSeconds`, the three timing labels, and accepted formats and size limits for media, holding photos and invites |
| `effects.json` | The floor reaction library: `id`, `name`, `description`, `preview` (`type: image` or `video`, plus `src`), `animation` (`float`, `spin`, `burst`, `twinkle`) and `count` per step. Also the reaction size in tiles and the animation length |
| `templates.json` | Holding screen templates (photo frame shape and position, text slots, border, background style), the font list, and default colours |
| `extras.json` | Extras and pricing. `liveContentExtraId` is the extra that drives **Add live content**, and its `priceAud` is the price shown |

To use real effect artwork, put the file in `public/effects/` (or anywhere it can be served from) and change that effect's `preview.src`, and `preview.type` if it's a video. The picker and the floor preview both update with no code change.

## Open questions

These are left mocked on purpose. Nothing here has been decided.

1. **Hosting.** Where the portal is deployed.
2. **Customer login method.** How customers sign in (replaces `MockAuthProvider`).
3. **Storage and upload limits.** Where design data and uploaded files are stored, and the real size limits (replaces `LocalStorageProvider`, limits in `portal.json`).
4. **Airtable link.** Whether and how the portal links to the Stomp Airtable Leads/Bookings base (`appwMfJFb7rLDqJ30`), and which fields map to floor size, screens booked and extras (replaces `MockBookingSource`).
5. **Final floor effect visuals.** Jannes to supply the real effect videos and photos (swap them in `effects.json`).
6. **Live content pricing flow.** When a customer whose booking doesn't include Live event streaming ticks Add live content, does the booking price change, or does Stomp just get notified? For now the tick is recorded as a request (`liveContentRequested` in the design) and nothing is charged.

## Copy conventions

UI copy is in Australian English and avoids dashes as punctuation.
