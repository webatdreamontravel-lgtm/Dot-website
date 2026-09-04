/**
 * Finds every image URL a trip references.
 *
 * Used to work out which stored objects a save has orphaned. Getting this
 * wrong in the "missed a field" direction deletes a photo that is still on the
 * page, so it walks EVERY field that can hold an uploaded URL:
 *
 *   cardImage, heroImage          plain URL strings
 *   itinerary                     days[].image, plus days[].body rich text
 *   introduction, inclusions,     rich-text documents, each able to hold
 *   exclusions, thingsToKnow,     image nodes dropped in via the editor's
 *   cancellationPolicy            photo button
 *
 * Rich text is TipTap JSON. Rather than assume a shape, the walker recurses
 * over anything array- or object-like and collects `src` from any node typed
 * "image" — so a future editor extension that nests images differently is
 * still caught.
 */

/** The rich-text fields on Trip. Adding an <Editor> means adding it here. */
export const RICH_TEXT_FIELDS = [
  "introduction",
  "inclusions",
  "exclusions",
  "thingsToKnow",
  "cancellationPolicy",
] as const;

/** Only what the collector needs — callers select exactly these columns. */
export type TripImageFields = {
  cardImage?: string | null;
  heroImage?: string | null;
  itinerary?: unknown;
  introduction?: unknown;
  inclusions?: unknown;
  exclusions?: unknown;
  thingsToKnow?: unknown;
  cancellationPolicy?: unknown;
};

function addUrl(into: Set<string>, value: unknown): void {
  if (typeof value === "string" && value.trim()) into.add(value.trim());
}

/**
 * Recursively collects `attrs.src` from every image node in a rich-text doc.
 *
 * Depth-limited: TipTap documents are shallow, and an unbounded walk over
 * attacker-influenceable JSON is a stack overflow waiting to happen.
 */
function walkRichText(node: unknown, into: Set<string>, depth = 0): void {
  if (depth > 50 || node === null || typeof node !== "object") return;

  if (Array.isArray(node)) {
    for (const child of node) walkRichText(child, into, depth + 1);
    return;
  }

  const record = node as Record<string, unknown>;

  if (record.type === "image") {
    const attrs = record.attrs;
    if (attrs && typeof attrs === "object") {
      addUrl(into, (attrs as Record<string, unknown>).src);
    }
  }

  // Recurse through `content` and any other nested structure, so images
  // wrapped in a figure, a list item or a future node type still surface.
  for (const value of Object.values(record)) {
    if (value !== null && typeof value === "object") {
      walkRichText(value, into, depth + 1);
    }
  }
}

export function collectImageUrls(trip: TripImageFields): Set<string> {
  const urls = new Set<string>();

  addUrl(urls, trip.cardImage);
  addUrl(urls, trip.heroImage);

  // Itinerary days carry both a photo slot and a rich-text body.
  if (Array.isArray(trip.itinerary)) {
    for (const day of trip.itinerary) {
      if (day === null || typeof day !== "object") continue;
      const record = day as Record<string, unknown>;
      addUrl(urls, record.image);
      walkRichText(record.body, urls);
    }
  } else {
    // Defensive: if the shape ever changes, still sweep it for image nodes
    // rather than silently collecting nothing and deleting live photos.
    walkRichText(trip.itinerary, urls);
  }

  for (const field of RICH_TEXT_FIELDS) {
    walkRichText(trip[field], urls);
  }

  return urls;
}

/**
 * URLs present in `before` but not in `after` — the ones a save orphaned.
 */
export function orphanedUrls(before: Set<string>, after: Set<string>): string[] {
  return [...before].filter((url) => !after.has(url));
}
