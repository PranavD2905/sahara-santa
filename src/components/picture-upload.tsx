"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type PointerEvent } from "react";
import type { ActionState } from "@/app/groups/actions";
import { Button, Notice, buttonClass } from "./ui";

const VIEW = 280; // on-screen crop square, px
const OUT = 512; // uploaded square, px
const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const MAX_ZOOM = 4;

type Upload = (state: ActionState, form: FormData) => Promise<ActionState>;

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
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(
    () => () => {
      if (img) URL.revokeObjectURL(img.url);
    },
    [img],
  );

  // Scale at which the image just covers the square.
  const base = img ? VIEW / Math.min(img.w, img.h) : 1;
  const scale = base * zoom;

  const clamp = (x: number, y: number, s = scale) =>
    img
      ? {
          x: Math.min(0, Math.max(VIEW - img.w * s, x)),
          y: Math.min(0, Math.max(VIEW - img.h * s, y)),
        }
      : { x, y };

  function onFile(file: File | undefined) {
    setError(null);
    setMessage(null);
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return setError("Use a JPG, PNG, or WebP image.");
    if (file.size > MAX_INPUT_BYTES) return setError("Images must be 5 MB or smaller.");
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      const s = VIEW / Math.min(el.naturalWidth, el.naturalHeight);
      setImg({ el, url, w: el.naturalWidth, h: el.naturalHeight });
      setZoom(1);
      // Start centred.
      setPos({ x: (VIEW - el.naturalWidth * s) / 2, y: (VIEW - el.naturalHeight * s) / 2 });
    };
    el.onerror = () => setError("That file couldn't be opened as an image.");
    el.src = url;
  }

  function onZoom(next: number) {
    // Zoom around the centre of the square.
    const c = VIEW / 2;
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
    const side = VIEW / scale;
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
    <div className="space-y-3">
      {img ? (
        <>
          <div
            className="relative mx-auto touch-none select-none overflow-hidden rounded-md border-2 border-ink bg-night"
            style={{ width: VIEW, height: VIEW, cursor: "grab" }}
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
              className="w-full"
            />
          </label>
          <div className="flex justify-center gap-2">
            <Button type="button" onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save picture"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setImg(null)} disabled={pending}>
              Cancel
            </Button>
          </div>
        </>
      ) : (
        <label className={`cursor-pointer ${buttonClass("secondary")}`}>
          {label}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}
      <Notice tone="error">{error}</Notice>
      <Notice tone="success">{message}</Notice>
    </div>
  );
}
