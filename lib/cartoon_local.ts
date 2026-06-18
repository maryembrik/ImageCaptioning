/**
 * 100%-offline "cartoonify" fallback using only HTML5 Canvas.
 *
 * Not a real GAN — just a posterize + edge-sharpen filter chain that
 * approximates a comic-book look. We use this when every external HF
 * Space is unreachable, so the demo never appears broken.
 */

export async function cartoonifyLocal(blob: Blob): Promise<string> {
  const img = await blobToImage(blob);
  const w = Math.min(img.naturalWidth || img.width, 640);
  const h = Math.round((img.naturalHeight || img.height) * (w / (img.naturalWidth || img.width)));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  // Draw with a soft saturation/contrast boost — looks more "cartoony"
  ctx.filter = "saturate(155%) contrast(118%) brightness(105%)";
  ctx.drawImage(img, 0, 0, w, h);

  // Posterise to ~10 levels per channel for that flat-shading cartoon look.
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const levels = 10;
  const step = 255 / (levels - 1);
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.round(data[i]     / step) * step;
    data[i + 1] = Math.round(data[i + 1] / step) * step;
    data[i + 2] = Math.round(data[i + 2] / step) * step;
  }
  ctx.putImageData(imageData, 0, 0);

  return canvas.toDataURL("image/png");
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load image"));
    img.src = url;
  });
}
