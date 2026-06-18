"use client";

import { useRef, useState } from "react";

type Props = {
  /** Callback fired with both the Blob (for the API) and a preview URL (for <img>). */
  onImage: (blob: Blob, previewUrl: string) => void;
  /** Optional caption shown under the dropzone. */
  hint?: string;
  /** Optional className for the outer container. */
  className?: string;
};

/**
 * Drag-and-drop / click-to-upload image picker.
 */
export default function ImageUploader({ onImage, hint, className }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    onImage(file, url);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleFiles(f);
  };

  return (
    <div
      className={"uploader" + (dragging ? " dragging" : "") + (className ? ` ${className}` : "")}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFiles(f);
          e.target.value = "";
        }}
      />
      <div className="uploader-inner">
        <div className="uploader-glyph">🖼</div>
        <div className="uploader-text">
          <b>Drop an image</b> or click to browse
        </div>
        {hint && <div className="uploader-hint">{hint}</div>}
      </div>
    </div>
  );
}

/**
 * Stable preview area with an overlay button to clear the image.
 *
 * NOTE: we intentionally do NOT call URL.revokeObjectURL on the preview blob.
 * React StrictMode (enabled by default in Next.js dev) runs cleanups twice,
 * which would revoke the URL immediately after it's set and prevent the image
 * from loading. The browser frees the blob memory on tab close anyway.
 */
export function ImagePreview({
  src,
  onClear,
}: {
  src: string;
  onClear: () => void;
}) {
  return (
    <div className="plate">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="uploaded" />
      <div className="plate-toolbar">
        <span className="chip">your upload</span>
        <button className="iconbtn" title="Remove" onClick={onClear}>
          ✕
        </button>
      </div>
    </div>
  );
}
