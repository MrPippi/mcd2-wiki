export interface PanelSize {
  readonly width: number;
  readonly height: number;
}

/**
 * The smallest whole zoom at which a square render of `imageSize` px (shown 1:1 at `zMax`) still covers the panel,
 * so zooming out never reveals empty space around the map.
 */
export function fillZoom(panel: PanelSize, imageSize: number, zMax: number): number {
  const longest = Math.max(panel.width, panel.height);
  if (!(longest > 0) || !(imageSize > 0)) return 0;
  const zoom = zMax + Math.ceil(Math.log2(longest / imageSize));
  return Math.min(zMax, Math.max(0, zoom));
}
