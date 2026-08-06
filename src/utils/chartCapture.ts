/**
 * Turns a mounted Recharts `<svg>` into a PNG data URL, for embedding real chart images into the
 * PDF report instead of just their underlying data tables. Recharts colors many elements via
 * `currentColor` and CSS custom properties (e.g. `var(--color-accent)`), which only resolve
 * through the live DOM's cascade — a bare `XMLSerializer` clone loses that context and would
 * render as black shapes, so computed colors are inlined onto the clone before serializing.
 */

const STYLE_PROPS = ["fill", "stroke", "stop-color", "color", "opacity", "stroke-width", "font-size", "font-family", "font-weight"];

function inlineComputedStyles(source: Element, clone: Element) {
  const computed = getComputedStyle(source);
  for (const prop of STYLE_PROPS) {
    const value = computed.getPropertyValue(prop);
    if (value) (clone as HTMLElement).style.setProperty(prop, value);
  }
  for (let i = 0; i < source.children.length; i++) {
    const sourceChild = source.children[i];
    const cloneChild = clone.children[i];
    if (sourceChild && cloneChild) inlineComputedStyles(sourceChild, cloneChild);
  }
}

async function svgToPngDataUrl(svg: SVGSVGElement, scale = 2): Promise<{ dataUrl: string; width: number; height: number }> {
  const rect = svg.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineComputedStyles(svg, clone);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const svgString = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to rasterize chart SVG"));
      image.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    return { dataUrl: canvas.toDataURL("image/png"), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Finds the Recharts `<svg>` inside a chart's container and rasterizes it. Returns null if the
 * container isn't mounted or has no chart yet (e.g. an empty dataset never rendered one). */
export async function captureChart(container: HTMLDivElement | null | undefined): Promise<{ dataUrl: string; width: number; height: number } | null> {
  if (!container) return null;
  const svg = container.querySelector("svg");
  if (!svg) return null;
  try {
    return await svgToPngDataUrl(svg as unknown as SVGSVGElement);
  } catch (err) {
    console.error("Chart capture failed", err);
    return null;
  }
}

/** Waits a couple of animation frames plus a short settle delay, so a just-mounted tab's charts
 * (Recharts animates bars/areas in on entrance) are fully drawn before being captured. */
export async function waitForChartsToSettle(delayMs = 350): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}
