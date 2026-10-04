import { useEffect, useState } from 'react';
import { useServices } from '../services';
import type { StoredFile } from '../types';

export function useFileUrl(file: StoredFile | null | undefined): string | null {
  const { storage } = useServices();
  const [url, setUrl] = useState<string | null>(null);
  const id = file?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (id) storage.getFileUrl(id).then((u) => !cancelled && setUrl(u));
    return () => {
      cancelled = true;
    };
  }, [id, storage]);

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
