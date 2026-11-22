"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type PointerEvent } from "react";
import type { ActionState } from "@/app/groups/actions";
import { Button, Notice } from "./ui";

const VIEW = 280; // on-screen crop square, px
const OUT = 512; // uploaded square, px
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_ZOOM = 4;

type Upload = (state: ActionState, form: FormData) => Promise<ActionState>;

type PickerWindow = Window & {
  showOpenFilePicker?: (options: {
    multiple: boolean;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ getFile(): Promise<File> }[]>;
};

interface Img {
  el: HTMLImageElement;
  url: string;
  w: number;
  h: number;
}

/**
 * Instagram-style picture crop: drag to pan, slider to zoom, inside a
 * circle. Exports a 512×512 square (shown as a circle everywhere); the
 * server re-encodes it and strips metadata.
 */
export function PictureUpload({ upload, label = "Choose picture" }: { upload: Upload; label?: string }) {
  const router = useRouter();
  const [img, setImg] = useState<Img | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [nativeFallback, setNativeFallback] = useState(false);
  const [viewSize, setViewSize] = useState(VIEW);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewSizeRef = useRef(VIEW);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.floor(entry.contentRect.width);
      if (width < 1) return;
      const next = Math.min(VIEW, width);
      const previous = viewSizeRef.current;
      if (next === previous) return;
      viewSizeRef.current = next;
      setViewSize(next);
      // Preserve the chosen crop when a phone rotates or the viewport changes.
      setPos((p) => ({ x: p.x * next / previous, y: p.y * next / previous }));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(
    () => () => {
      if (img) URL.revokeObjectURL(img.url);
    },
    [img],
  );

  // Scale at which the image just covers the square.
  const base = img ? viewSize / Math.min(img.w, img.h) : 1;
  const scale = base * zoom;

  const clamp = (x: number, y: number, s = scale) =>
    img
      ? {
          x: Math.min(0, Math.max(viewSize - img.w * s, x)),
          y: Math.min(0, Math.max(viewSize - img.h * s, y)),
        }
      : { x, y };

  function onFile(file: File | undefined) {
    setError(null);
    setMessage(null);
    if (!file) return;
    const supported = /^image\/(jpeg|png|webp)$/i.test(file.type) ||
      ((!file.type || file.type === "application/octet-stream") && /\.(jpe?g|png|webp)$/i.test(file.name));
    if (!supported) return setError("Use a JPG, PNG, or WebP image.");
    if (file.size > MAX_INPUT_BYTES) return setError("Images must be 5 MB or smaller.");
    setLoading(true);
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      const size = viewSizeRef.current;
      const s = size / Math.min(el.naturalWidth, el.naturalHeight);
      setImg({ el, url, w: el.naturalWidth, h: el.naturalHeight });
      setZoom(1);
      // Start centred.
      setPos({ x: (size - el.naturalWidth * s) / 2, y: (size - el.naturalHeight * s) / 2 });
      setLoading(false);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      setLoading(false);
      setError("That file couldn't be opened as an image. Try a JPG, PNG, or WebP photo.");
    };
    el.src = url;
  }

  async function choosePicture() {
    setError(null);
    const browser = window as PickerWindow;
    try {
      // Invoke the browser picker directly in the click, before any await.
      if (browser.showOpenFilePicker) {
        const [handle] = await browser.showOpenFilePicker({
          multiple: false,
          types: [{ description: "Pictures", accept: {
            "image/jpeg": [".jpg", ".jpeg"],
            "image/png": [".png"],
            "image/webp": [".webp"],
          } }],
        });
        if (handle) onFile(await handle.getFile());
        return;
      }
      const input = fileInputRef.current;
      if (!input) return;
      input.value = "";
      if (typeof input.showPicker === "function") input.showPicker();
      else input.click();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNativeFallback(true);
      setError("The picker could not open. Choose a file below or drag a photo into this area.");
    }
  }

  function onZoom(next: number) {
    // Zoom around the centre of the square.
    const c = viewSize / 2;
    const ratio = next / zoom;
    setZoom(next);
    setPos(clamp(c - (c - pos.x) * ratio, c - (c - pos.y) * ratio, base * next));
  }

  const onDown = (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ...pos };
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (d) setPos(clamp(d.x + e.clientX - d.px, d.y + e.clientY - d.py));
  };
  const onUp = () => (drag.current = null);

  async function exportBlob(): Promise<Blob> {
    if (!img) throw new Error("no image");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = OUT;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    const side = viewSize / scale;
    ctx.drawImage(img.el, -pos.x / scale, -pos.y / scale, side, side, 0, 0, OUT, OUT);
    const toBlob = (type: string) =>
      new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.9));
    // Browsers without WebP encoding hand back PNG; use JPEG then.
    const webp = await toBlob("image/webp");
    if (webp?.type === "image/webp") return webp;
    const jpeg = await toBlob("image/jpeg");
    if (!jpeg) throw new Error("export failed");
    return jpeg;
  }

  function save() {
    startTransition(async () => {
      setError(null);
      try {
        const blob = await exportBlob();
        const form = new FormData();
        form.set("picture", new File([blob], `picture.${blob.type.split("/")[1]}`, { type: blob.type }));
        const result = await upload({}, form);
        if (result.error) setError(result.error);
        else {
          setMessage(result.message ?? "Saved.");
          setImg(null);
          router.refresh();
        }
      } catch {
        setError("Couldn't prepare the picture. Try another image.");
      }
    });
  }

  return (
    <div
      ref={containerRef}
      className="min-w-0 space-y-3"
      data-picture-editor={img || loading || pending ? "active" : undefined}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("Files")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (!loading && !pending) onFile(event.dataTransfer.files[0]);
      }}
      onPaste={(event) => {
        const file = Array.from(event.clipboardData.files).find((f) => f.type.startsWith("image/"));
        if (file && !loading && !pending) {
          event.preventDefault();
          onFile(file);
        }
      }}
    >
      {img ? (
        <>
          <div
            className="relative mx-auto touch-none select-none overflow-hidden rounded-md border-2 border-ink bg-night"
            style={{ width: viewSize, maxWidth: "100%", aspectRatio: "1 / 1", cursor: "grab" }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img
              src={img.url}
              alt=""
              draggable={false}
              className="pointer-events-none absolute left-0 top-0 max-w-none"
              style={{ width: img.w * scale, height: img.h * scale, transform: `translate(${pos.x}px, ${pos.y}px)` }}
            />
            {/* Circle mask: everything outside the circle is dimmed. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
            />
          </div>
          <label className="mx-auto block max-w-[280px] space-y-1">
            <span className="text-sm">Zoom</span>
            <input
              type="range"
              min={1}
              max={MAX_ZOOM}
              step={0.01}
              value={zoom}
              onChange={(e) => onZoom(Number(e.target.value))}
              className="min-h-11 w-full accent-ink"
            />
          </label>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={save} disabled={pending} className="min-h-11 touch-manipulation">
              {pending ? "Saving…" : "Save picture"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setImg(null)} disabled={pending} className="min-h-11 touch-manipulation">
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <div className="space-y-3 rounded-md border border-dashed border-ink/35 p-4">
          <Button type="button" variant="secondary" onClick={choosePicture} disabled={loading || pending} className="min-h-11 touch-manipulation">
            {loading ? "Opening picture…" : label}
          </Button>
          <p className="text-xs text-muted">You can also drop or paste a photo here. JPG, PNG or WebP, up to 5 MB.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={label}
            tabIndex={nativeFallback ? 0 : -1}
            disabled={loading || pending}
            className={nativeFallback ? "block min-h-11 w-full max-w-full text-base text-ink" : "sr-only"}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              onFile(file);
            }}
          />
        </div>
      )}
      <Notice tone="error">{error}</Notice>
      <Notice tone="success">{message}</Notice>
    </div>
  );
}
