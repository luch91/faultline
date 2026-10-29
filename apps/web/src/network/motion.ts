// Frame boundaries measured from the unaltered 557-frame, 30 fps reference.
export const REFERENCE_DURATION = 557 / 30;
const clamp = (n: number) => Math.min(1, Math.max(0, n));
export const ease = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
export function motionAt(seconds: number) {
  const t = Math.max(0, Math.min(REFERENCE_DURATION, seconds));
  let focus = 0, expansion = 0, analytics = 0, yaw = 0, pitch = 0, roll = 0, scale = 1, x = 0, y = 0, environment = 0;
  if (t >= 47 / 30 && t < 314 / 30) {
    environment = 1; scale = .81; yaw = -27; pitch = 3; roll = -5; x = -.015; y = -.035;
    focus = ease((t - 1.9) / .6); expansion = ease((t - 2.6) / 2.05);
    if (t >= 7) { yaw = 16; pitch = 1; roll = 4; scale = .82; x = -.015; y = -.045; analytics = ease((t - 7) / .85); }
  } else if (t >= 314 / 30 && t < 388 / 30) {
    environment = 1; scale = .64; yaw = -4; pitch = 0; roll = 0; x = 0; y = -.03;
  } else if (t >= 388 / 30 && t < 530 / 30) {
    const progress = ease((t - 12.933333) / 2.8);
    environment = 1 - progress; scale = .89 + .11 * progress; yaw = -5 * (1 - progress); y = -.01 * (1 - progress);
  } else if (t >= 530 / 30) {
    environment = 1; scale = .81; yaw = -27; pitch = 3; roll = -5; x = -.015; y = -.035;
    focus = ease((t - 18.05) / .5); expansion = 0;
  }
  return { t, focus, expansion, analytics, yaw, pitch, roll, scale, x, y, environment, phase: focus > .02 ? 'focus' : 'overview' };
}
export type Motion = ReturnType<typeof motionAt>;

export type Quad = [[number, number], [number, number], [number, number], [number, number]];
const lerpQuad = (a: Quad, b: Quad, t: number): Quad => a.map((point, i) => [point[0] + (b[i]![0] - point[0]) * t, point[1] + (b[i]![1] - point[1]) * t]) as Quad;
export function screenQuadAt(t: number): Quad {
  const flat: Quad = [[0, 6], [750, 6], [750, 490], [0, 490]];
  const angled: Quad = [[160, -110], [620, -125], [590, 305], [180, 455]];
  if (t < 47 / 30) return flat;
  if (t < 7) return lerpQuad(angled, [[80, -25], [650, -5], [640, 350], [110, 455]], ease((t - 1.566667) / 5.38));
  if (t < 314 / 30) return lerpQuad([[65, -30], [620, 20], [593, 446], [97, 335]], [[70, -40], [645, 8], [638, 450], [100, 350]], ease((t - 7) / 3.45));
  if (t < 388 / 30) return [[130, 28], [618, 28], [614, 372], [131, 370]];
  if (t < 530 / 30) return lerpQuad([[80, 15], [830, 15], [830, 505], [85, 505]], [[-20, 5], [735, 5], [735, 490], [-20, 490]], ease((t - 12.933333) / 3.3));
  return angled;
}

// Homography maps the live DOM plane to the measured screen corners. It keeps
// browser hit testing, text selection, focus, and graph interaction intact.
export function projectScreen(quad: Quad): string {
  const source = [[0, 0], [750, 0], [750, 490], [0, 490]];
  const matrix: number[][] = [];
  source.forEach(([x = 0, y = 0], i) => {
    const [u, v] = quad[i]!;
    matrix.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    matrix.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  });
  for (let column = 0; column < 8; column++) {
    let pivot = column;
    for (let row = column + 1; row < 8; row++) if (Math.abs(matrix[row]![column]!) > Math.abs(matrix[pivot]![column]!)) pivot = row;
    [matrix[column], matrix[pivot]] = [matrix[pivot]!, matrix[column]!];
    const divisor = matrix[column]![column]!;
    for (let cell = column; cell < 9; cell++) matrix[column]![cell] = matrix[column]![cell]! / divisor;
    for (let row = 0; row < 8; row++) if (row !== column) { const factor = matrix[row]![column]!; for (let cell = column; cell < 9; cell++) matrix[row]![cell] = matrix[row]![cell]! - factor * matrix[column]![cell]!; }
  }
  const [a, b, c, d, e, f, g, h] = matrix.map(row => row[8]!);
  return `matrix3d(${[a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1].join(',')})`;
}
