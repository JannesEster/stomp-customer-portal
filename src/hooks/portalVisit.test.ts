import { describe, expect, it } from 'vitest';
import { createDefaultDesign } from '../lib/design';
import { floorPreviewHash } from './floorPreviewSync';
import { commitUserEdit, openPortalOnDevice, shouldSendFloorPreview } from './portalVisit';
import type { DesignState, StoredFile } from '../types';

const TOKEN = 'F'.repeat(43);

function savedDesign(): DesignState {
  const design = createDefaultDesign({ coupleNames: 'Sam and Alex' }, new Date('2026-11-01T00:00:00.000Z'));
  design.status = 'submitted';
  design.submittedAt = '2026-11-02T00:00:00.000Z';
  design.entranceTime = '16:40';
  design.designs.holding.names = 'Sam and Alex';
  design.designs.holding.media = {
    id: 'file-hands',
    name: 'hands.jpg',
    type: 'image/jpeg',
    size: 80_000,
  };
  design.invite = { id: 'file-invite', name: 'invite.pdf', type: 'application/pdf', size: 20_000 };
  design.invitePalette = ['#112233', '#gold00'];
  design.inviteNamesColour = '#112233';
  design.invitePaper = '#fff8e7';
  return design;
}

describe('opening the portal on a fresh device', () => {
  it('does not post answers or a floor preview, then keeps invite and name-only files after one edit', async () => {
    const remote = savedDesign();
    const posts: string[] = [];
    const post = async (path: string) => {
      posts.push(path);
    };

    const open = async () =>
      openPortalOnDevice({
        design: remote,
        migrate: true,
        readBlob: async () => null,
        upload: async () => {
          throw new Error('name-only files are not sent');
        },
      });

    const opened = await open();
    const again = await open();
    if (opened.dirty || again.dirty) await post(`/api/portal/${TOKEN}/answers`);
    const preview = shouldSendFloorPreview({
      userEdited: false,
      explicit: false,
      previousHash: opened.previewHash,
      nextHash: floorPreviewHash(opened.design),
    });
    if (preview) await post(`/api/portal/${TOKEN}/preview`);

    expect(posts).toEqual([]);
    expect(opened.dirty).toBe(false);
    expect(again.dirty).toBe(false);
    expect(opened.design.designs.holding.media).toEqual(remote.designs.holding.media);
    expect(opened.design.designs.holding.media?.uploadState).toBeUndefined();
    expect(opened.design.invite).toEqual(remote.invite);
    expect(opened.design.status).toBe('submitted');
    expect(preview).toBe(false);

    const saved = commitUserEdit(opened.design, remote, (design) => ({ ...design, entranceTime: '18:15' }));
    expect(saved.entranceTime).toBe('18:15');
    expect(saved.invite).toEqual(remote.invite);
    expect(saved.invitePalette).toEqual(remote.invitePalette);
    expect(saved.inviteNamesColour).toBe(remote.inviteNamesColour);
    expect(saved.invitePaper).toBe(remote.invitePaper);
    expect(saved.designs.holding.media).toEqual(remote.designs.holding.media as StoredFile);
    expect(shouldSendFloorPreview({
      userEdited: true,
      explicit: false,
      previousHash: opened.previewHash,
      nextHash: floorPreviewHash(saved),
    })).toBe(false);
  });

  it('does not send a floor preview when only the page has loaded, even if the hash was empty', () => {
    const design = savedDesign();
    expect(
      shouldSendFloorPreview({
        userEdited: false,
        explicit: false,
        previousHash: null,
        nextHash: floorPreviewHash(design),
      }),
    ).toBe(false);
    const changed = floorPreviewHash({
      ...design,
      designs: { ...design.designs, holding: { ...design.designs.holding, styleId: 'gold-rings' } },
    });
    expect(
      shouldSendFloorPreview({
        userEdited: true,
        explicit: false,
        previousHash: floorPreviewHash(design),
        nextHash: changed,
      }),
    ).toBe(true);
  });
});
