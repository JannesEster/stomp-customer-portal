# Stomp Sphere customer portal

A web portal where a booked Stomp Sphere customer plans what appears on their LED dance floor and portrait screens on the night. The **Design** tab is fully built, as a guided flow of one step at a time. **My Bookings** and **Notes/Details** are simple placeholders.

Everything runs locally on seed data. There are no live external services, no real customer data, and nothing leaves the browser.

## Live site

The demo is published with GitHub Pages at https://jannesester.github.io/stomp-customer-portal/. On every push to `main`, `.github/workflows/deploy.yml` runs the tests, builds with `--mode pages` (which serves the site from the `/stomp-customer-portal/` subfolder) and deploys it. It runs on the same seed data, so each visitor's design is saved only in their own browser. Media paths in the config files start from the site root, and `fromRoot` in `src/config/index.ts` adds the subfolder.

## Setup

Requires Node 20 or newer.

```bash
npm install
npm start          # dev server at http://localhost:5173, opens the Design tab
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm test` | Unit tests (Vitest): floor pixel formula, screen count, live content rules, upload validation, phase logic, screen timings, and that every media file named in the config exists |
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
  lib/             Pure logic: dimensions, floor renderer, live content rules, validation
  hooks/           useDesignState (load, autosave, submit), useFileUrl, useImage
  design/          Design tab steps, step list, previews and summary
  tabs/            My Bookings, Notes/Details, Design
public/effects/    10 second recordings (640 x 480, on black) of Stomp's floor reactions, with posters
public/templates/  Holding screen videos (1024 x 768): clean/ has no names or dates and plays on the floor;
                   the samples with example names and their posters are for the style gallery
public/dancing/    Short 640 x 480 previews of the colourful dancing videos (Pixabay licence), with posters
public/screens/    Portrait screen designs (512 x 1536 JPEGs from Canva, with example names)
```

Built with React, TypeScript and Vite. No UI or state libraries. PDF.js (`pdfjs-dist`) is bundled to read PDF invites in the browser.

Styling follows stompsphere.com.au: black background, Inter for text, italic Playfair Display with the pink, orange and blue gradient for accent words, and pill buttons. The design tokens are at the top of `src/styles.css`. Both fonts are bundled through `@fontsource`, so the portal makes no font requests to external services. The white Stomp Sphere logo is in `public/brand/`.

- **Floor preview** (`design/FloorPreview.tsx`): a `<canvas>` sized to the exact floor pixels (`width_m x 256` by `length_m x 256` with the default config). `lib/floorRender.ts` draws the chosen style's clean video into it every frame, cover fitted, so floors that aren't 4:3 crop rather than stretch, and `lib/liveText.ts` draws the couple's names and the event date over it. Until a style is picked, the names are drawn on a plain floor. CSS scales the canvas to fit while keeping the aspect ratio. The real pixel size is shown under it. A tile grid overlay can be toggled. The picked reactions play over the canvas as recordings of the real floor programs with someone walking across them. They are on black and screen blended, so the design shows through; reactions marked `fillsFloor` bring their own scene and cover it instead. Several picks take turns, one recording each.
- **Holding screen styles**: the customer picks one of the styles in `holding-styles.json` and gives their names and a photo or video of the two of them. Each style's `live` settings place the names (as one line, stacked around "&" or "and", over two lines, or as initials), the event date from the booking in that style's format, and any fixed wording, in fonts close to the Canva originals. The invite's names colour, if there is one, replaces the style's. Stomp makes the finished version, including the couple's photo for styles marked `usesPhoto`. The gallery lists the styles without a photo first, then the `usesPhoto` ones, each in the order they appear in the file.
- **Invite colours**: when a couple uploads an invite (`design/InviteUpload.tsx`), `lib/invite.ts` renders it in the browser (the first page for PDFs, which also becomes the thumbnail) and `lib/palette.ts` picks out its main colours, ranking colourful accents like gold ahead of plain black text. The colours are saved with the design as `invitePalette`, and the first one is meant for the couple's names.
- **Designs generated from the invite**: once an invite is uploaded, **Generate a design from my invite** (`lib/inviteStyle.ts`) builds a holding screen from the invite's paper and ink colours and the styling note. Colour words in the note (sage, navy, terracotta and so on) set the accent or floor colour, and mood words (modern, classic, romantic, boho, art deco) pick the lettering and layout. The floor is always dark, because big areas of white look harsh on LED, so a light invite is flipped to light lettering on black. `lib/generatedRender.ts` draws it live with the couple's names, the booking date, ornaments and drifting sparkles. It appears as **From your invite** at the start of the style gallery; **Try another version** steps through other layouts and lettering until the invite or note changes.
- **Guided steps** (`tabs/DesignTab.tsx`, `design/steps.tsx`): the Design tab shows one step at a time.
  1. **Your details**: the couple's names (prefilled from the booking, and used on the holding screen), with the wedding date and venue from the booking shown read only.
  2. **Your holding screen**: the style gallery, the invite or styling upload and the photo of the two of them.
  3. **Floor reactions**: the only place reactions are chosen.
  4. **After the bridal entrance**: what the floor shows until dancing time.
  5. **Dancing time**: what the floor shows while people dance.
  6. **Your screen design**: the portrait screen design gallery.
  7. **Screens before the entrance**: the screen design or the couple's own photos and videos.
  8. **Screens after the entrance**: the same choice, until dancing time.
  9. **Screens during the dancing**: the same choice, while people dance.
  10. **Review and submit**: live content, the design summary and **Submit design to Stomp**.

  Bookings with no screens skip steps 6 to 9. The step list at the top groups the steps under Floor, Screens and Finish and jumps to any of them. On phones and tablets it shows "Step 3 of 10" with a progress bar, and the list scrolls sideways. The bar at the bottom shows the save status with **Back** and **Next** (named after the next step), which becomes **Submit design to Stomp** on the last step. Steps 1 to 5 show the floor preview and steps 6 to 9 the screens preview, each starting on that step's part of the night. The previews keep their own part of the night switch, which never changes the step.
- **Parts of the night**: **After the bridal entrance** keeps the holding screen and its reactions (recommended), or can use a second style. **Dancing time** defaults to a blank floor that rotates through every reaction (recommended), or can play the colourful videos in `dancing-videos.json`, which the preview cycles through without reactions, or use a second style. `holdingFor` and `reactionsFor` in `lib/design.ts` resolve what each part shows.
- **Screens** (`design/ScreenSteps.tsx`, `design/ScreensPreview.tsx`): the couple picks one of the designs in `screen-styles.json`, welcome signs first, then the order of the day boards. They're Canva samples with example names baked in, so the portal shows them as a style gallery and Stomp makes the finished version with the couple's names and date. For each part of the night, `screens.modes` says whether the screens show that design (recommended before the entrance) or the couple's photos and videos. Photos and videos are uploaded in the step for their part of the night and kept in `media` with a `timing`: `start` before the bridal entrance, `middle` after it and `end` for dancing time (`timingFor` in `lib/design.ts`). The timings used to be labelled Start, Middle and End of night. Their ids haven't changed, so uploads saved before keep working. The preview shows one portrait frame per booked screen at the size in `portal.json`, with the chosen design or a slideshow of that part's photos and videos.
- **Saving** (`hooks/useDesignState.ts`): the whole design is one `DesignState` object (`src/types.ts`), autosaved through `StorageProvider` 400 ms after each change and flushed on page hide. A design saved before a field existed, such as `screens`, gets it from the defaults (`usableDesign`). **Submit design to Stomp** sets `status: 'submitted'` and shows the summary. Any later edit returns it to draft until it's submitted again.

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
| `portal.json` | `floor.tileSizeMm` and `floor.tilePx` (the pixel formula), screen `widthPx`, `heightPx`, `maxScreens` and `slideSeconds`, the labels for the three timings the screens' photos and videos are saved with (Before the bridal entrance, After the bridal entrance and Dancing time), and accepted formats and size limits for media, the couple's holding screen photo or video, and invites |
| `effects.json` | The floor reaction library, in the order shown: `id`, `name`, `description`, the recording (`video`) and `poster`, `popular` for the fantasy reactions listed first, `fillsFloor` for reactions that bring their own scene, and `program`, the floor program each one comes from, numbered as in Stomp's U3D or 129款互动游戏 folder |
| `holding-styles.json` | The fonts used on the floor, and the holding screen styles: `id`, `name`, `description`, the clean `video`, the `sampleVideo` and `poster` for the gallery, `usesPhoto`, and `live` (where and how the names, date and fixed wording are drawn, as fractions of the 1024 x 768 frame) |
| `dancing-videos.json` | The colourful videos for dancing time: `id`, `name`, preview `src` and `poster` (in `public/dancing/`), and `rotateSeconds` for how long the preview shows each one |
| `screen-styles.json` | The portrait screen designs: `id`, `name`, `description` (shown when hovering a design), the sample `image` in `public/screens/`, and `kind`, either `welcome` for a welcome sign or `schedule` for an order of the day with the wedding party or ceremony |
| `extras.json` | Extras and pricing. `liveContentExtraId` is the extra that drives **Add live content**, and its `priceAud` is the price shown |

To add a reaction, record about 10 seconds of its program running with someone walking on it, crop to 4:3, and save a 640 x 480 MP4 and a JPEG poster in `public/effects/`. Record it on black so it layers over a holding screen. The programs draw their effect over whatever is in their `bgPic` and `bgVideo` folders, which is how the holding screen goes behind a reaction on the night, so record a copy with black files in both. The Fantasy programs also need background mode `1` (picture) or `2` (video) in their `config.ini`. Koi pond's background is built into the program, so it is marked `fillsFloor`. The Flash programs in 129款互动游戏 no longer run on Windows, so they were recorded in Ruffle, an open source Flash player. Then add an entry to `effects.json`; the picker and the floor preview update with no code change. Saved designs drop any reaction that is removed from the file.

Each entry in the `fonts` map lists the Canva font first and a free stand-in after it, for example `Hatton, Fraunces, Georgia, serif`. Playfair Display, Parisienne and Cormorant Garamond are free and used as is. The others are paid fonts that Canva licenses for use inside Canva only, so the portal bundles close free matches through `@fontsource` (see `src/main.tsx`). To use a real one, buy its web licence, add the font file with an `@font-face` rule using the same family name, and the preview picks it up with no other change.

To add a holding screen style, export it from Canva twice: once as the sample with example names, and once with the names and date deleted. Put the sample and a JPEG poster frame in `public/templates/`, the clean one in `public/templates/clean/`, and add an entry to `holding-styles.json` with the text positions. Remove an entry to retire a style.

To add a screen design, export it from Canva as a 512 x 1536 PNG, the exact size of the portrait screens, and convert it to a high quality JPEG in `public/screens/` named after the design, for example `ffmpeg -i design.png -pix_fmt yuvj444p -q:v 2 public/screens/cherry-blossom.jpg` (full colour detail keeps thin coloured lettering crisp). Then add an entry to `screen-styles.json`; the gallery and the screens preview update with no code change, and the tests check the image exists. Remove an entry to retire a design.

## Open questions

These are left mocked on purpose. Nothing here has been decided.

1. **Hosting.** Where the portal is deployed.
2. **Customer login method.** How customers sign in (replaces `MockAuthProvider`).
3. **Storage and upload limits.** Where design data and uploaded files are stored, and the real size limits (replaces `LocalStorageProvider`, limits in `portal.json`).
4. **Airtable link.** Whether and how the portal links to the Stomp Airtable Leads/Bookings base (`appwMfJFb7rLDqJ30`), and which fields map to floor size, screens booked and extras (replaces `MockBookingSource`).
5. **Live content pricing flow.** When a customer whose booking doesn't include Live event streaming ticks Add live content, does the booking price change, or does Stomp just get notified? For now the tick is recorded as a request (`liveContentRequested` in the design) and nothing is charged.

## Copy conventions

UI copy is in Australian English and avoids dashes as punctuation.
