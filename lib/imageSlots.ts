/**
 * The shape and size every uploaded trip photo is stored at.
 *
 * These exist because the shapes were previously only *suggested*: the
 * uploader took an `aspect` prop, but it styled the preview frame and nothing
 * else, so a portrait photo dropped into the hero slot showed a correct 16:9
 * preview and then stored a 1080×1350 portrait. Stored images ranged from
 * 1.83 to 0.67 in the same itinerary, which is why the day photos rendered at
 * wildly different heights.
 *
 * One definition, used by three places that must agree:
 *   - the cropper, for the frame it locks to
 *   - the upload pipeline, for the pixels it writes
 *   - the public page, for the box it renders into
 *
 * Cropping on the way in is also what makes it cheap: the slot stores exactly
 * the pixels it uses, instead of storing a portrait and throwing half of it
 * away at render.
 */

export type ImageSlot = {
  /** width / height. What the cropper locks to. */
  aspect: number;
  /** Stored pixel size. Width drives it; height follows the aspect. */
  width: number;
  height: number;
  /** For the CSS `aspect-ratio` property on preview and render frames. */
  css: string;
  label: string;
};

export const IMAGE_SLOTS = {
  /**
   * The homepage and listing grid, which is `aspect-[5/6]`. The featured
   * tile is 16:11 and takes the middle band of the same portrait, so one
   * crop serves both rather than asking for two uploads.
   */
  card: { aspect: 5 / 6, width: 1250, height: 1500, css: "5 / 6", label: "Card photo" },

  /**
   * The banner on the trip page. Letterboxed to roughly 2.4:1 on desktop and
   * cropped to a narrow centre column on mobile, so 16:9 is the shape that
   * survives both — provided the subject is near the middle.
   */
  hero: { aspect: 16 / 9, width: 2560, height: 1440, css: "16 / 9", label: "Hero photo" },

  /**
   * One itinerary day. Previously unconstrained, which is the ragged-heights
   * bug. 16:9 keeps every day the same height and stays calm inside a column
   * of text — 4:3 would be 525px tall at content width.
   */
  day: { aspect: 16 / 9, width: 1600, height: 900, css: "16 / 9", label: "Day photo" },
} as const satisfies Record<string, ImageSlot>;

export type ImageSlotName = keyof typeof IMAGE_SLOTS;

/**
 * The shapes a photo inside a content section may take.
 *
 * A choice rather than one fixed shape, because unlike the card or the hero
 * there is no single right answer here: a section photo might be a wide view
 * of a valley or an upright shot of a waterfall, and forcing the second into
 * 16:9 removes the reason it was chosen. Three is the point — the page gets
 * a predictable rhythm because every content photo is one of three known
 * shapes instead of whatever came off a phone, and the person writing the
 * section still decides which.
 *
 * Wide leads because it matches the itinerary day photos and reads as the
 * house shape; portrait deliberately reuses the card's 5:6 so an image can
 * be moved between the two without a second crop.
 */
export const CONTENT_SHAPES = [
  { key: "wide", aspect: 16 / 9, width: 1600, height: 900, css: "16 / 9", label: "Wide" },
  { key: "square", aspect: 1, width: 1200, height: 1200, css: "1 / 1", label: "Square" },
  { key: "portrait", aspect: 5 / 6, width: 1200, height: 1440, css: "5 / 6", label: "Portrait" },
] as const satisfies readonly (ImageSlot & { key: string })[];

export type ContentShape = (typeof CONTENT_SHAPES)[number];

/**
 * The slot for an upload target.
 *
 * Day photos arrive as `day-1`, `day-2`… so they are matched by prefix.
 * Anything else — rich-text images, most obviously — has no fixed shape:
 * an inline photo is decorative and sits in the flow at whatever shape it
 * is, so forcing it into a frame would be wrong.
 */
export function slotFor(target: string): ImageSlot | null {
  if (target.startsWith("day-")) return IMAGE_SLOTS.day;
  return (IMAGE_SLOTS as Record<string, ImageSlot>)[target] ?? null;
}
