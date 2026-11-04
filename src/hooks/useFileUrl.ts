import { useEffect, useState } from 'react';
import { useServices } from '../services';
import type { StoredFile } from '../types';

export function useFileUrl(file: StoredFile | null | undefined): string | null {
  const { storage, portal } = useServices();
  const [url, setUrl] = useState<string | null>(null);
  const id = file?.id ?? null;
  const saved = file?.uploadState === 'saved' && !!file.attachmentId;
  const remote =
    file?.attachmentId && portal?.token
      ? `/api/portal/${encodeURIComponent(portal.token)}/files/${encodeURIComponent(file.attachmentId)}?variant=${
          file.type.startsWith('video/') ? 'full' : 'thumb'
        }`
      : null;

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    // A saved file is served from the booking, because the copy on this device may still be the original HEIC.
    if (saved && remote) {
      setUrl(remote);
      return;
    }
    if (id) {
      void storage.getFileUrl(id).then((local) => {
        if (cancelled) return;
        setUrl(local ?? remote);
      });
    } else if (remote) {
      setUrl(remote);
    }
    return () => {
      cancelled = true;
    };
  }, [id, remote, saved, storage]);

  return url;
}

export function useImage(url: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    setImg(null);
    if (!url) return;
    let cancelled = false;
    const el = new Image();
    el.onload = () => !cancelled && setImg(el);
    el.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  return img;
}
