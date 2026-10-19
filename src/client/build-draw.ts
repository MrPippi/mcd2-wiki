/** Draws the build image on a canvas (browser only; the layout comes from card.ts). */
import { CARD_GAP, CARD_HEIGHT, CARD_ICON, CARD_PADDING, CARD_WIDTH, cardCells, fitText } from "../lib/build/card";
import type { BuildLabels, BuildOption } from "../lib/build/parse";
import type { EffectSlotKey, EnchantSlotKey, SlotKey } from "../lib/build/slots";

export interface CardInput {
  readonly title: string;
  readonly labels: BuildLabels;
  /** The picked option in each filled slot. */
  readonly picked: Readonly<Partial<Record<SlotKey, BuildOption>>>;
  /** "Name III" for each enchanted slot. */
  readonly enchanted: Readonly<Partial<Record<EnchantSlotKey, string>>>;
  /** "Sharpness III · Looting I" for each slot with effects. */
  readonly rolled: Readonly<Partial<Record<EffectSlotKey, string>>>;
  /** The page address printed at the bottom left. */
  readonly address: string;
  /** The game version line printed at the bottom right. */
  readonly version: string;
  /** Colours and fonts read from the page, so the image matches the site theme. */
  readonly theme: CardTheme;
}

export interface CardTheme {
  readonly paper: string;
  readonly plate: string;
  readonly ink: string;
  readonly muted: string;
  readonly accent: string;
  readonly rule: string;
  readonly display: string;
  readonly body: string;
}

const loadImage = (src: string): Promise<HTMLImageElement | undefined> =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(undefined); // the cell still shows its name
    image.src = src;
  });

async function loadIcons(picked: CardInput["picked"]): Promise<Map<string, HTMLImageElement>> {
  const sources = [...new Set(Object.values(picked).flatMap((option) => (option?.icon ? [option.icon] : [])))];
  const loaded = await Promise.all(sources.map(async (src) => [src, await loadImage(src)] as const));
  return new Map(loaded.flatMap(([src, image]) => (image ? [[src, image] as [string, HTMLImageElement]] : [])));
}

function drawFrame(ctx: CanvasRenderingContext2D, input: CardInput): void {
  const { theme, title, address, version } = input;
  const siteTitle = input.labels.siteTitle;
  ctx.fillStyle = theme.paper;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, 0, CARD_WIDTH, 8);
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = theme.muted;
  ctx.font = `600 20px ${theme.body}`;
  ctx.fillText(fitText(siteTitle, CARD_WIDTH - CARD_PADDING * 2, (text) => ctx.measureText(text).width), CARD_PADDING, CARD_PADDING + 8);
  ctx.fillStyle = theme.ink;
  ctx.font = `700 40px ${theme.display}`;
  ctx.fillText(fitText(title, CARD_WIDTH - CARD_PADDING * 2, (text) => ctx.measureText(text).width), CARD_PADDING, CARD_PADDING + 56);
  ctx.fillStyle = theme.muted;
  ctx.font = `16px ${theme.body}`;
  const footerY = CARD_HEIGHT - CARD_PADDING / 2 - 4;
  const half = (CARD_WIDTH - CARD_PADDING * 2) / 2 - CARD_GAP;
  const measure = (text: string) => ctx.measureText(text).width;
  ctx.fillText(fitText(address, half, measure), CARD_PADDING, footerY);
  ctx.textAlign = "right";
  ctx.fillText(fitText(version, half, measure), CARD_WIDTH - CARD_PADDING, footerY);
  ctx.textAlign = "left";
}

function drawCells(ctx: CanvasRenderingContext2D, input: CardInput, icons: ReadonlyMap<string, HTMLImageElement>): void {
  const { theme } = input;
  for (const cell of cardCells()) {
    const option = input.picked[cell.slot];
    const iconX = cell.x;
    const iconY = cell.y + (cell.height - CARD_ICON) / 2;
    ctx.fillStyle = theme.plate;
    ctx.fillRect(iconX, iconY, CARD_ICON, CARD_ICON);
    ctx.strokeStyle = option?.unique ? theme.accent : theme.rule;
    ctx.lineWidth = 2;
    ctx.strokeRect(iconX + 1, iconY + 1, CARD_ICON - 2, CARD_ICON - 2);
    const image = option?.icon ? icons.get(option.icon) : undefined;
    if (image) ctx.drawImage(image, iconX + 4, iconY + 4, CARD_ICON - 8, CARD_ICON - 8);
    const textX = iconX + CARD_ICON + CARD_GAP;
    const measure = (text: string) => ctx.measureText(text).width;
    ctx.fillStyle = theme.muted;
    ctx.font = `15px ${theme.body}`;
    ctx.fillText(fitText(input.labels.slots[cell.slot], cell.textWidth, measure), textX, iconY + 16);
    ctx.fillStyle = option ? theme.ink : theme.muted;
    ctx.font = `${option ? 700 : 400} 19px ${theme.body}`;
    ctx.fillText(fitText(option?.name ?? "—", cell.textWidth, measure), textX, iconY + 40);
    const enchant = input.enchanted[cell.slot as EnchantSlotKey];
    if (enchant) {
      ctx.fillStyle = theme.accent;
      ctx.font = `600 15px ${theme.body}`;
      ctx.fillText(fitText(enchant, cell.textWidth, measure), textX, iconY + 60);
    }
    const effects = input.rolled[cell.slot as EffectSlotKey];
    if (effects) {
      ctx.fillStyle = theme.muted;
      ctx.font = `13px ${theme.body}`;
      ctx.fillText(fitText(effects, cell.textWidth, measure), textX, iconY + (enchant ? 78 : 60));
    }
  }
}

/** The build image as a PNG blob. */
export async function drawCard(input: CardInput): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d context unavailable");
  await document.fonts.ready;
  const icons = await loadIcons(input.picked);
  drawFrame(ctx, input);
  drawCells(ctx, input, icons);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))), "image/png"));
}
