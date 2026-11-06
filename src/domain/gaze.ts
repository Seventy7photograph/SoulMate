export interface GazePoint {
  x: number;
  y: number;
}

export interface GazeBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizePointer(
  clientX: number,
  clientY: number,
  bounds: GazeBounds,
): GazePoint {
  if (!bounds.width || !bounds.height) {
    return { x: 0, y: 0 };
  }

  return {
    x: clamp(((clientX - bounds.left) / bounds.width) * 2 - 1, -1, 1),
    y: clamp(((clientY - bounds.top) / bounds.height) * 2 - 1, -1, 1),
  };
}

