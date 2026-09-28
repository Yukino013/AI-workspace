export const WHALE_STORAGE_KEY = "ai-workbench:whale-pet:v1";
export const PET_MARGIN = 12;
export interface PetPoint {
  x: number;
  y: number;
}
export interface PetViewport {
  width: number;
  height: number;
}
export interface PetPreferences {
  visible: boolean;
  asleep: boolean;
  position: PetPoint | null;
}

export function petSize(width: number): PetViewport {
  return width <= 760
    ? { width: 112, height: 116 }
    : { width: 156, height: 150 };
}

export function petBounds(viewport: PetViewport) {
  const size = petSize(viewport.width);
  return {
    minX: PET_MARGIN,
    minY: PET_MARGIN,
    maxX: Math.max(PET_MARGIN, viewport.width - size.width - PET_MARGIN),
    maxY: Math.max(PET_MARGIN, viewport.height - size.height - PET_MARGIN),
  };
}
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));
export function clampPetPosition(
  point: PetPoint,
  viewport: PetViewport,
): PetPoint {
  const b = petBounds(viewport);
  return {
    x: clamp(point.x, b.minX, b.maxX),
    y: clamp(point.y, b.minY, b.maxY),
  };
}
export function relativePetPosition(
  point: PetPoint,
  viewport: PetViewport,
): PetPoint {
  const b = petBounds(viewport);
  const safe = clampPetPosition(point, viewport);
  return {
    x: (safe.x - b.minX) / Math.max(1, b.maxX - b.minX),
    y: (safe.y - b.minY) / Math.max(1, b.maxY - b.minY),
  };
}
export function restorePetPosition(
  position: PetPoint | null,
  viewport: PetViewport,
): PetPoint {
  const b = petBounds(viewport);
  return clampPetPosition(
    position
      ? {
          x: b.minX + position.x * (b.maxX - b.minX),
          y: b.minY + position.y * (b.maxY - b.minY),
        }
      : { x: b.maxX - 12, y: b.maxY - 18 },
    viewport,
  );
}
export function readPetPreferences(
  raw: string | null,
  compact: boolean,
): PetPreferences {
  const defaults: PetPreferences = {
    visible: !compact,
    asleep: false,
    position: null,
  };
  if (!raw) return defaults;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value))
      return defaults;
    const saved = value as Partial<PetPreferences>;
    const point = saved.position;
    return {
      visible:
        typeof saved.visible === "boolean" ? saved.visible : defaults.visible,
      asleep: typeof saved.asleep === "boolean" ? saved.asleep : false,
      position:
        point &&
        typeof point.x === "number" &&
        typeof point.y === "number" &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y)
          ? { x: clamp(point.x, 0, 1), y: clamp(point.y, 0, 1) }
          : null,
    };
  } catch {
    return defaults;
  }
}
