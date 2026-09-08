"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Loader2, RotateCw, X, ZoomIn } from "lucide-react";

import type { ImageSlot } from "@/lib/imageSlots";
import { cn } from "@/lib/utils";

/**
 * Crops a picked photo to its slot's shape before it is uploaded.
 *
 * Opens for every photo, not only the ones that don't fit. A cropper that
 * appears sometimes is a cropper nobody trusts — and even a photo already at
 * 16:9 usually wants to be nudged, because the thing worth keeping is rarely
 * dead centre. When the shape already matches, the default frame is the whole
 * image and Use photo is one tap.
 *
 * The crop is done here rather than on the server so the phone uploads the
 * cropped pixels and nothing else: a 4000×3000 camera photo becomes a
 * 1600×900 day image before it touches the network.
 */
export function ImageCropper({
  file,
  slot,
  shapes,
  onCancel,
  onCropped,
}: {
  file: File;
  /** The shape to start on. With `shapes`, the one selected by default. */
  slot: ImageSlot;
  /**
   * Offer a choice of shapes instead of locking to one.
   *
   * Used by content sections, where a photo may legitimately be wide or
   * upright. Omitted for card, hero and day, which have exactly one correct
   * shape and shouldn't present a decision that can only be got wrong.
   */
  shapes?: readonly (ImageSlot & { key: string })[];
  onCancel: () => void;
  onCropped: (cropped: File) => void;
}) {
  const [shape, setShape] = useState<ImageSlot>(slot);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [area, setArea] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Object URL rather than a data URL: a 10MB base64 string is 13MB of
   * JavaScript string, and this runs on a phone.
   *
   * Created inside the effect and revoked by the SAME effect's cleanup, so
   * each URL is revoked exactly once and a remount always gets a fresh one.
   *
   * The obvious-looking version — useMemo to create, an effect to revoke —
   * is broken, and broken as a race, which is why it survived a first round
   * of testing. React's dev double-invoke runs mount → cleanup → mount; the
   * cleanup revokes the URL, and useMemo hands the same dead string back on
   * the second mount. Whether you see anything then depends on whether the
   * browser had already fetched the blob: a small image wins that race and
   * looks fine, a photo off a camera roll loses it and the cropper opens on
   * a blank screen.
   */
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    // An object URL is exactly the external resource this rule carves out:
    // it has to be created and released in step with the mount, and state is
    // the only way to hand the value to React.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Escape closes, because this covers the whole screen and the only other
  // way out is a button someone has to find.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const done = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  const apply = async () => {
    if (!area) return;
    setWorking(true);
    try {
      onCropped(await renderCrop(file, area, rotation, shape));
    } catch {
      setWorking(false);
      setError("Couldn't crop that photo. Try again, or pick a different one.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Crop ${shape.label.toLowerCase()}`}
      className="fixed inset-0 z-[90] flex flex-col bg-navy/95 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between px-4 py-3 text-cream">
        <div>
          <p className="text-[0.95rem] font-medium">Crop {shape.label.toLowerCase()}</p>
          <p className="text-[0.8rem] text-cream/60">
            Drag to move, pinch or use the slider to zoom · saved at {shape.width}×{shape.height}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="grid h-10 w-10 cursor-pointer place-items-center rounded-full text-cream/80 transition hover:bg-cream/10 hover:text-cream"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {shapes && shapes.length > 1 && (
        <div className="flex gap-2 px-4 pb-3" role="group" aria-label="Photo shape">
          {shapes.map((s) => {
            const active = s.aspect === shape.aspect;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setShape(s)}
                aria-pressed={active}
                className={cn(
                  "h-9 cursor-pointer rounded-full border px-4 text-[0.85rem] transition",
                  active
                    ? "border-teal bg-teal text-cream"
                    : "border-cream/25 text-cream/80 hover:bg-cream/10",
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="relative flex-1">
        {!src && (
          <div className="absolute inset-0 grid place-items-center text-cream/60">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          </div>
        )}
        {src && (
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={shape.aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={done}
          showGrid
          restrictPosition
          objectFit="contain"
        />
        )}
      </div>

      {error && (
        <p role="alert" className="px-4 pb-1 text-[0.85rem] text-coral">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
        <label className="flex flex-1 items-center gap-3 text-cream">
          <ZoomIn className="h-4 w-4 flex-none" aria-hidden />
          <span className="sr-only">Zoom</span>
          <input
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-cream/25 accent-teal"
          />
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-cream/25 px-4 text-[0.9rem] text-cream transition hover:bg-cream/10"
          >
            <RotateCw className="h-4 w-4" aria-hidden /> Rotate
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!area || working}
            className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full bg-teal px-6 text-[0.95rem] font-medium text-cream transition hover:bg-teal-bright disabled:opacity-60 sm:flex-none"
          >
            {working && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {working ? "Working…" : "Use photo"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Draws the chosen region at exactly the slot's stored size.
 *
 * Decodes from the File, not from the object URL the preview is using. Tying
 * both to one URL looked tidy and was a bug: React's dev double-invoke runs
 * the effect as mount → cleanup → mount, the cleanup revokes the URL, and the
 * remount hands back the same revoked string from useMemo. The `<img>` on
 * screen keeps showing because it had already decoded — so the preview looked
 * perfect while every crop failed with an image load error.
 *
 * createImageBitmap also decodes off the main thread, which on a phone with a
 * 12MP photo is the difference between a pause and a freeze.
 *
 * Two canvases, because rotation and cropping don't compose in one pass: the
 * first holds the rotated image so the crop rectangle react-easy-crop reports
 * lines up with what was on screen, the second is the output at slot size.
 * Drawing straight to the output size does the downscale in the same step, so
 * a 4000px camera photo never exists at full size in a second buffer.
 */
async function renderCrop(
  file: File,
  area: Area,
  rotation: number,
  shape: ImageSlot,
): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const turned = rotation % 180 !== 0;
    const stage = document.createElement("canvas");
    stage.width = turned ? bitmap.height : bitmap.width;
    stage.height = turned ? bitmap.width : bitmap.height;
    const sctx = stage.getContext("2d");
    if (!sctx) throw new Error("no 2d context");
    sctx.translate(stage.width / 2, stage.height / 2);
    sctx.rotate((rotation * Math.PI) / 180);
    sctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);

    const out = document.createElement("canvas");
    out.width = shape.width;
    out.height = shape.height;
    const octx = out.getContext("2d");
    if (!octx) throw new Error("no 2d context");
    octx.imageSmoothingQuality = "high";
    octx.drawImage(
      stage,
      area.x, area.y, area.width, area.height,
      0, 0, shape.width, shape.height,
    );

    const blob = await new Promise<Blob | null>((resolve) =>
      // WebP at 0.9: the upload pipeline converts to WebP anyway, so encoding
      // here avoids a JPEG round trip in between.
      out.toBlob(resolve, "image/webp", 0.9),
    );
    if (!blob) throw new Error("encode failed");

    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", {
      type: "image/webp",
    });
  } finally {
    bitmap.close();
  }
}
