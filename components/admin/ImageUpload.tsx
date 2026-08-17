"use client";

import { useId, useRef, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { ACCEPT_ATTRIBUTE, MAX_UPLOAD_MB, uploadImage } from "@/lib/uploadImage";

/**
 * Picks, compresses and uploads a photo, then holds the resulting public
 * URL in a hidden input so the surrounding <form> submits it like any other
 * field.
 *
 * Compression happens in the browser on purpose: a phone photo is commonly
 * 4-8 MB, and the founders will be uploading straight from their camera
 * roll. Resizing before the request keeps uploads fast on a stall's mobile
 * connection and keeps a 1 GB storage tier viable.
 */
export function ImageUpload({
  name,
  slot,
  label,
  hint,
  aspect,
  defaultValue,
  onChange,
  compact,
}: {
  /** Renders a hidden input when set; omit and use onChange instead. */
  name?: string;
  slot: string;
  label?: string;
  hint?: string;
  /** CSS aspect-ratio for the preview frame, e.g. "5 / 6". */
  aspect: string;
  defaultValue?: string | null;
  onChange?: (url: string) => void;
  compact?: boolean;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File) {
    setError(null);

    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setError("Only JPG and PNG photos can be uploaded.");
      return;
    }

    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(
        `That photo is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_UPLOAD_MB} MB.`,
      );
      return;
    }

    setBusy(true);
    const result = await uploadImage(file, slot);
    setBusy(false);
    // Allows re-picking the same file after a failure.
    if (fileRef.current) fileRef.current.value = "";

    if ("error" in result) {
      setError(result.error);
      return;
    }
    setUrl(result.url);
    onChange?.(result.url);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-[0.82rem] font-semibold text-[#16203a]">{label}</span>}
      {hint && <span className="-mt-0.5 text-[0.78rem] text-[#8b96ad]">{hint}</span>}

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={cn(
          "relative overflow-hidden rounded-xl border-[1.5px] border-dashed bg-[#fcfdfe] transition",
          dragging ? "border-teal bg-teal/[0.06]" : "border-[#e3e7ee]",
        )}
        style={{ aspectRatio: aspect }}
      >
        {url ? (
          <>
            {/* Deliberately a plain <img>: the URL is user-supplied at
                runtime and next/image would need known dimensions. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={label ?? "Uploaded photo"} className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/70 to-transparent p-2.5">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                className="rounded-lg bg-white/95 px-2.5 py-1.5 text-[0.76rem] font-medium hover:bg-white disabled:opacity-60"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={() => { setUrl(""); setError(null); onChange?.(""); }}
                className="inline-flex items-center gap-1 rounded-lg bg-white/95 px-2.5 py-1.5 text-[0.76rem] font-medium text-[#c33a3a] hover:bg-white"
              >
                <Trash2 className="h-3 w-3" /> Remove
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center"
          >
            {busy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-teal" />
                <span className="text-[0.8rem] text-[#5a6785]">Uploading…</span>
              </>
            ) : (
              <>
                <ImagePlus className={compact ? "h-4 w-4 text-[#8b96ad]" : "h-6 w-6 text-[#8b96ad]"} />
                <span className={compact ? "text-[0.76rem] font-medium text-[#16203a]" : "text-[0.83rem] font-medium text-[#16203a]"}>
                  {compact ? "Add photo" : "Choose a photo"}
                </span>
                {!compact && (
                  <span className="text-[0.76rem] leading-relaxed text-[#8b96ad]">
                    or drag one here
                    <br />
                    JPG or PNG, up to {MAX_UPLOAD_MB} MB
                  </span>
                )}
              </>
            )}
          </button>
        )}

        {busy && url && (
          <div className="absolute inset-0 grid place-items-center bg-white/70">
            <Loader2 className="h-5 w-5 animate-spin text-teal" />
          </div>
        )}
      </div>

      {error && (
        <span className="flex items-start gap-1 text-[0.78rem] font-medium text-[#c33a3a]">
          <AlertCircle className="mt-[1px] h-3 w-3 flex-none" /> {error}
        </span>
      )}

      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      {name && <input type="hidden" name={name} value={url} readOnly />}
    </div>
  );
}
