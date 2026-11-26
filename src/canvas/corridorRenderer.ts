import type {
  ControllerMode,
  CorridorWorldState,
  SignalPhase,
  VisualCar,
} from '../engine/types';
import { spriteManager, type CanonicalSpriteKey } from './spriteManager';

export interface RenderCorridorOptions {
  world: CorridorWorldState;
  cars: readonly VisualCar[];
  mode: ControllerMode;
  linkCapacity: number;
  saturationThreshold: number;
  useSprites: boolean;
  timeSeconds: number;
  compact?: boolean;
}

const NEON = {
  bg: '#090a14',
  panel: '#111428',
  asphalt: '#161b30',
  asphaltEdge: '#232c4f',
  cyan: '#00f0ff',
  green: '#39ff14',
  amber: '#ffb800',
  pink: '#ff0055',
  white: '#e6edf7',
  muted: '#7d8bb8',
} as const;

function getApproachLightColor(phase: SignalPhase, isF1: boolean): 'green' | 'yellow' | 'red' {
  if (isF1) {
    if (phase === 'F1') return 'green';
    if (phase === 'Y1') return 'yellow';
    return 'red';
  }
  if (phase === 'F2') return 'green';
  if (phase === 'Y2') return 'yellow';
  return 'red';
}

function drawPixelBuilding(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  accent: string,
  seed: number
): void {
  ctx.fillStyle = '#0d1022';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#1e274b';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  // Techo neón sutil
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.25;
  ctx.fillRect(x + 2, y + 2, w - 4, 3);
  ctx.globalAlpha = 1;

  // Ventanas pixeladas
  const cols = Math.max(2, Math.floor((w - 10) / 10));
  const rows = Math.max(2, Math.floor((h - 12) / 10));
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const hash = (seed * 31 + r * 17 + c * 13) % 7;
      if (hash === 0 || hash === 2 || hash === 5) {
        ctx.fillStyle = hash === 5 ? accent : '#273363';
        ctx.fillRect(x + 6 + c * 10, y + 9 + r * 10, 5, 5);
      }
    }
  }
}

function drawProceduralCar(
  ctx: CanvasRenderingContext2D,
  colorVariant: 0 | 1 | 2,
  stopped: boolean,
  length: number,
  width: number
): void {
  const bodies = ['#00d9e8', '#ffb800', '#ff0055'] as const;
  const highlights = ['#9bfaff', '#ffe38c', '#ff85ad'] as const;
  const body = bodies[colorVariant];
  const hi = highlights[colorVariant];

  const halfL = Math.round(length / 2);
  const halfW = Math.round(width / 2);

  // Sombra sólida pixelada
  ctx.fillStyle = '#04050a';
  ctx.fillRect(-halfL + 2, -halfW + 2, length, width);

  // Llantas
  ctx.fillStyle = '#07080f';
  ctx.fillRect(-halfL + 3, -halfW - 2, 6, 3);
  ctx.fillRect(halfL - 9, -halfW - 2, 6, 3);
  ctx.fillRect(-halfL + 3, halfW - 1, 6, 3);
  ctx.fillRect(halfL - 9, halfW - 1, 6, 3);

  // Carrocería
  ctx.fillStyle = body;
  ctx.fillRect(-halfL, -halfW, length, width);

  // Borde superior brillo
  ctx.fillStyle = hi;
  ctx.fillRect(-halfL + 2, -halfW + 1, length - 4, 2);

  // Cabina y parabrisas
  ctx.fillStyle = '#0c1229';
  ctx.fillRect(-halfL + 6, -halfW + 3, length - 12, width - 6);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(halfL - 8, -halfW + 3, 3, width - 6);

  // Faros delanteros neón (lado +X)
  ctx.fillStyle = '#e0ffff';
  ctx.fillRect(halfL - 2, -halfW + 2, 3, 3);
  ctx.fillRect(halfL - 2, halfW - 5, 3, 3);

  // Haz de luz delantera
  ctx.fillStyle = 'rgba(0, 240, 255, 0.22)';
  ctx.fillRect(halfL + 1, -halfW + 1, 10, 4);
  ctx.fillRect(halfL + 1, halfW - 5, 10, 4);

  // Luces de freno traseras rojas (brillan más cuando el auto frena en cola)
  ctx.fillStyle = stopped ? '#ff0055' : '#801030';
  ctx.fillRect(-halfL - 1, -halfW + 2, 2, 3);
  ctx.fillRect(-halfL - 1, halfW - 5, 2, 3);
  if (stopped) {
    ctx.fillStyle = 'rgba(255, 0, 85, 0.45)';
    ctx.fillRect(-halfL - 5, -halfW + 1, 4, width - 2);
  }
}

function drawTrafficLightUnit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: 'green' | 'yellow' | 'red',
  countdown: number,
  label: string,
  orientation: 'vertical' | 'horizontal'
): void {
  const glowColor =
    color === 'green' ? NEON.green : color === 'yellow' ? NEON.amber : NEON.pink;

  ctx.save();

  if (orientation === 'vertical') {
    // Semáforo VERTICAL (perpendicular a la avenida HORIZONTAL)
    // Halo neón exterior
    ctx.fillStyle = glowColor;
    ctx.globalAlpha = color === 'yellow' ? 0.34 : 0.22;
    ctx.fillRect(x - 14, y - 24, 28, 48);
    ctx.globalAlpha = 1;

    // Carcasa vertical pixel-art
    ctx.fillStyle = '#090a14';
    ctx.fillRect(x - 10, y - 21, 20, 42);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 10, y - 21, 20, 42);

    // 3 luces verticales: Rojo arriba, Amarillo centro, Verde abajo
    ctx.fillStyle = color === 'red' ? NEON.pink : '#2d1220';
    ctx.fillRect(x - 4, y - 16, 8, 8);
    ctx.fillStyle = color === 'yellow' ? NEON.amber : '#2e2510';
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = color === 'green' ? NEON.green : '#102e14';
    ctx.fillRect(x - 4, y + 8, 8, 8);

    // Cuenta regresiva debajo
    ctx.fillStyle = '#090a14';
    ctx.fillRect(x - 18, y + 24, 36, 15);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 18, y + 24, 36, 15);

    ctx.fillStyle = glowColor;
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${countdown}s`, x, y + 32);

    ctx.fillStyle = NEON.muted;
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText(label, x, y - 28);
  } else {
    // Semáforo HORIZONTAL (perpendicular a la calle VERTICAL)
    ctx.fillStyle = glowColor;
    ctx.globalAlpha = color === 'yellow' ? 0.34 : 0.22;
    ctx.fillRect(x - 24, y - 14, 48, 28);
    ctx.globalAlpha = 1;

    // Carcasa horizontal pixel-art
    ctx.fillStyle = '#090a14';
    ctx.fillRect(x - 21, y - 10, 42, 20);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 2;
    ctx.strokeRect(x - 21, y - 10, 42, 20);

    // 3 luces horizontales: Rojo izquierda, Amarillo centro, Verde derecha
    ctx.fillStyle = color === 'red' ? NEON.pink : '#2d1220';
    ctx.fillRect(x - 16, y - 4, 8, 8);
    ctx.fillStyle = color === 'yellow' ? NEON.amber : '#2e2510';
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = color === 'green' ? NEON.green : '#102e14';
    ctx.fillRect(x + 8, y - 4, 8, 8);

    // Cuenta regresiva a la derecha o debajo
    ctx.fillStyle = '#090a14';
    ctx.fillRect(x - 18, y + 13, 36, 15);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - 18, y + 13, 36, 15);

    ctx.fillStyle = glowColor;
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${countdown}s`, x, y + 21);

    ctx.fillStyle = NEON.muted;
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.fillText(label, x, y - 17);
  }

  ctx.restore();
}

/**
 * Mapeo lineal por tramos sincronizado exactamente con los hitos de simulator.ts
 * para que cada auto frene justo en la línea blanca del paso de cebra y despeje el cuadrado.
 */
function mapPiecewise(t: number, knots: readonly number[], values: readonly number[]): number {
  if (t <= knots[0]) return values[0];
  for (let i = 0; i < knots.length - 1; i += 1) {
    if (t <= knots[i + 1]) {
      const local = (t - knots[i]) / Math.max(1e-6, knots[i + 1] - knots[i]);
      return values[i] + local * (values[i + 1] - values[i]);
    }
  }
  return values[values.length - 1];
}

function drawLinkBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: number,
  capacity: number,
  satThreshold: number
): void {
  const ratio = Math.max(0, Math.min(1, value / capacity));
  const pct = Math.round(ratio * 100);
  const barColor = ratio >= satThreshold ? NEON.pink : ratio >= 0.55 ? NEON.amber : NEON.green;

  ctx.fillStyle = '#090a14';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = barColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  // Segmentos pixelados
  const segments = 12;
  const filledSegments = Math.round(ratio * segments);
  const segW = (w - 8) / segments;
  for (let i = 0; i < segments; i += 1) {
    ctx.fillStyle = i < filledSegments ? barColor : '#1b2242';
    ctx.fillRect(x + 4 + i * segW, y + 4, Math.max(2, segW - 2), h - 8);
  }

  ctx.fillStyle = NEON.white;
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${label}: ${value.toFixed(1)}/${capacity} veh (${pct}%)`, x + w / 2, y - 4);
}

function drawQueueBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  queueValue: number
): void {
  const color = queueValue >= 18 ? NEON.pink : queueValue >= 10 ? NEON.amber : NEON.cyan;
  ctx.fillStyle = 'rgba(9, 10, 20, 0.92)';
  ctx.fillRect(x - 44, y - 11, 88, 22);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 44, y - 11, 88, 22);

  ctx.fillStyle = color;
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${label}: ${queueValue.toFixed(1)}`, x, y);
}

/**
 * Dibuja el nombre de una calle orientado exactamente a lo largo de la vía:
 * - angleRad = 0 para avenidas horizontales
 * - angleRad = -Math.PI / 2 para calles verticales
 */
function drawStreetNameAlongRoad(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  angleRad: number,
  color: string,
  compact?: boolean
): void {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(angleRad);
  ctx.font = compact
    ? 'bold 8px "JetBrains Mono", monospace'
    : 'bold 10px "JetBrains Mono", monospace';
  const metrics = ctx.measureText(text);
  const padX = 6;
  const boxW = Math.ceil(metrics.width) + padX * 2;
  const boxH = compact ? 13 : 16;

  ctx.fillStyle = 'rgba(9, 10, 20, 0.78)';
  ctx.fillRect(-Math.round(boxW / 2), -Math.round(boxH / 2), boxW, boxH);
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  ctx.strokeRect(-Math.round(boxW / 2), -Math.round(boxH / 2), boxW, boxH);

  ctx.globalAlpha = 0.95;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 0.5);
  ctx.restore();
}

/**
 * Dibuja Plaza Avaroa en estilo Retro Pixel-Art Neón en el cuadrante Noroeste
 * (bordeada por C. Belisario Salinas al norte, Av. 20 de Octubre al este y C. Pedro Salazar al sur).
 */
function drawPlazaAvaroa(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  compact?: boolean
): void {
  if (w < 40 || h < 34) return;

  // Césped nocturno oscuro
  ctx.fillStyle = '#0a2216';
  ctx.fillRect(x, y, w, h);

  // Borde verde neón
  ctx.strokeStyle = NEON.green;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  // Senderos diagonales pixelados y cruz central
  const cx = Math.round(x + w / 2);
  const cy = Math.round(y + h / 2);
  ctx.strokeStyle = 'rgba(57, 255, 20, 0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 6, y + 6);
  ctx.lineTo(x + w - 6, y + h - 6);
  ctx.moveTo(x + w - 6, y + 6);
  ctx.lineTo(x + 6, y + h - 6);
  ctx.moveTo(cx, y + 4);
  ctx.lineTo(cx, y + h - 4);
  ctx.moveTo(x + 4, cy);
  ctx.lineTo(x + w - 4, cy);
  ctx.stroke();

  // Árboles pixel-art en las esquinas
  const treeOffsets = [
    [x + 16, y + 16],
    [x + w - 16, y + 16],
    [x + 16, y + h - 16],
    [x + w - 16, y + h - 16],
  ] as const;
  for (const [tx, ty] of treeOffsets) {
    ctx.fillStyle = '#14522d';
    ctx.fillRect(tx - 6, ty - 6, 12, 12);
    ctx.fillStyle = NEON.green;
    ctx.fillRect(tx - 3, ty - 3, 6, 6);
  }

  // Monumento / Fuente central de Eduardo Avaroa
  ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
  ctx.fillRect(cx - 12, cy - 12, 24, 24);
  ctx.fillStyle = '#111428';
  ctx.fillRect(cx - 8, cy - 8, 16, 16);
  ctx.strokeStyle = NEON.cyan;
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 8, cy - 8, 16, 16);
  ctx.fillStyle = NEON.cyan;
  ctx.fillRect(cx - 3, cy - 3, 6, 6);

  // Cartel pixel-art "PLAZA AVAROA"
  const badgeW = Math.min(w - 12, compact ? 96 : 118);
  const badgeH = compact ? 15 : 18;
  ctx.fillStyle = 'rgba(9, 10, 20, 0.9)';
  ctx.fillRect(cx - Math.round(badgeW / 2), y + h - badgeH - 5, badgeW, badgeH);
  ctx.strokeStyle = NEON.green;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(cx - Math.round(badgeW / 2), y + h - badgeH - 5, badgeW, badgeH);

  ctx.fillStyle = NEON.green;
  ctx.font = compact
    ? 'bold 8px "JetBrains Mono", monospace'
    : 'bold 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PLAZA AVAROA', cx, y + h - Math.round(badgeH / 2) - 4);
}

/**
 * Renderizador principal del corredor Sopocachi, La Paz:
 * Plaza Avaroa / Av. 20 de Octubre (I1) — Av. 6 de Agosto (I2),
 * conectados por C. Pedro Salazar y C. Belisario Salinas.
 */
export function renderCorridorCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  options: RenderCorridorOptions
): void {
  const { world, cars, mode, linkCapacity, saturationThreshold, useSprites, timeSeconds, compact } =
    options;

  ctx.imageSmoothingEnabled = false;

  // 1. Fondo noche paceña
  ctx.fillStyle = NEON.bg;
  ctx.fillRect(0, 0, width, height);

  // Cuadrícula sutil retro
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.045)';
  ctx.lineWidth = 1;
  for (let gx = 0; gx < width; gx += 24) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, height);
    ctx.stroke();
  }
  for (let gy = 0; gy < height; gy += 24) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }

  // Geometría proporcional (Sopocachi — Plaza Avaroa)
  const roadH = compact ? 74 : 90;
  const roadW = compact ? 70 : 84;
  const centerY = Math.round(height * 0.58);
  const i1X = Math.round(width * 0.29);
  const i2X = Math.round(width * 0.72);
  const halfRoadH = Math.round(roadH / 2);
  const halfRoadW = Math.round(roadW / 2);

  // Franja superior: C. Belisario Salinas (borde norte de Plaza Avaroa)
  const belisarioH = compact ? 22 : 28;
  const belisarioTop = compact ? 42 : 48;
  const belisarioMidY = belisarioTop + Math.round(belisarioH / 2);
  const belisarioBottom = belisarioTop + belisarioH;

  // 2. Bloques urbanos + PLAZA AVAROA (cuadrante noroeste entre Belisario Salinas, 20 de Octubre y Pedro Salazar)
  const bPad = 10;
  drawPlazaAvaroa(
    ctx,
    bPad,
    belisarioBottom + 6,
    i1X - halfRoadW - bPad * 2,
    centerY - halfRoadH - belisarioBottom - 16,
    compact
  );
  drawPixelBuilding(
    ctx,
    i1X + halfRoadW + bPad,
    belisarioBottom + 8,
    i2X - i1X - roadW - bPad * 2,
    Math.max(24, centerY - halfRoadH - belisarioBottom - 54),
    NEON.amber,
    2
  );
  drawPixelBuilding(
    ctx,
    i2X + halfRoadW + bPad,
    belisarioBottom + 8,
    width - (i2X + halfRoadW) - bPad * 2,
    Math.max(24, centerY - halfRoadH - belisarioBottom - 20),
    NEON.pink,
    3
  );
  drawPixelBuilding(
    ctx,
    bPad,
    centerY + halfRoadH + bPad,
    i1X - halfRoadW - bPad * 2,
    height - (centerY + halfRoadH) - bPad * 2,
    NEON.cyan,
    4
  );
  drawPixelBuilding(
    ctx,
    i1X + halfRoadW + bPad,
    centerY + halfRoadH + 34,
    i2X - i1X - roadW - bPad * 2,
    Math.max(24, height - (centerY + halfRoadH) - 46),
    NEON.cyan,
    5
  );
  drawPixelBuilding(
    ctx,
    i2X + halfRoadW + bPad,
    centerY + halfRoadH + bPad,
    width - (i2X + halfRoadW) - bPad * 2,
    height - (centerY + halfRoadH) - bPad * 2,
    NEON.amber,
    6
  );

  // 3. Calles (Sprite road_tile/calle si está habilitado y cargado, o fallback pixel-art)
  const roadSprite = useSprites ? spriteManager.getImage('road_tile') : null;
  const interSprite = useSprites ? spriteManager.getImage('road_intersection') : null;

  // Asfalto base: C. Belisario Salinas (arriba), C. Pedro Salazar (eje principal) y Av. 20 de Octubre / Av. 6 de Agosto
  ctx.fillStyle = '#14192d';
  ctx.fillRect(0, belisarioTop, width, belisarioH);
  ctx.fillStyle = '#2a3560';
  ctx.fillRect(0, belisarioTop - 2, width, 2);
  ctx.fillRect(0, belisarioBottom, width, 2);

  ctx.fillStyle = NEON.asphalt;
  ctx.fillRect(0, centerY - halfRoadH, width, roadH);
  ctx.fillRect(i1X - halfRoadW, 38, roadW, height - 38);
  ctx.fillRect(i2X - halfRoadW, 38, roadW, height - 38);

  // Líneas discontinuas amarillas en C. Belisario Salinas
  ctx.fillStyle = 'rgba(255, 184, 0, 0.72)';
  for (let x = 8; x < width; x += 22) {
    const inI1 = x > i1X - halfRoadW - 4 && x < i1X + halfRoadW + 4;
    const inI2 = x > i2X - halfRoadW - 4 && x < i2X + halfRoadW + 4;
    if (!inI1 && !inI2) {
      ctx.fillRect(x, belisarioMidY - 1, 10, 2);
    }
  }

  if (roadSprite) {
    // Textura pixel-art sutil encima del asfalto
    ctx.save();
    ctx.globalAlpha = 0.35;
    // Calles verticales (calle.png es vertical)
    for (let y = 38; y < height; y += roadW) {
      ctx.drawImage(roadSprite, i1X - halfRoadW, y, roadW, roadW);
      ctx.drawImage(roadSprite, i2X - halfRoadW, y, roadW, roadW);
    }
    // Calle horizontal (rotar tile 90°)
    for (let x = 0; x < width; x += roadH) {
      ctx.save();
      ctx.translate(x + roadH / 2, centerY);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(roadSprite, -roadH / 2, -roadH / 2, roadH, roadH);
      ctx.restore();
    }
    if (interSprite) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(interSprite, i1X - halfRoadW, centerY - halfRoadH, roadW, roadH);
      ctx.drawImage(interSprite, i2X - halfRoadW, centerY - halfRoadH, roadW, roadH);
    }
    ctx.restore();
  }

  // Bordes neón nítidos de las calzadas y aceras
  ctx.fillStyle = '#2d3a6b';
  ctx.fillRect(0, centerY - halfRoadH - 3, width, 3);
  ctx.fillRect(0, centerY + halfRoadH, width, 3);
  ctx.fillRect(i1X - halfRoadW - 3, 38, 3, height - 38);
  ctx.fillRect(i1X + halfRoadW, 38, 3, height - 38);
  ctx.fillRect(i2X - halfRoadW - 3, 38, 3, height - 38);
  ctx.fillRect(i2X + halfRoadW, 38, 3, height - 38);

  // Cajas de intersección limpias con borde sutil
  ctx.fillStyle = '#1b223d';
  ctx.fillRect(i1X - halfRoadW, centerY - halfRoadH, roadW, roadH);
  ctx.fillRect(i2X - halfRoadW, centerY - halfRoadH, roadW, roadH);
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(i1X - halfRoadW + 1, centerY - halfRoadH + 1, roadW - 2, roadH - 2);
  ctx.strokeRect(i2X - halfRoadW + 1, centerY - halfRoadH + 1, roadW - 2, roadH - 2);

  // Líneas amarillas discontinuas centrales (horizontal y verticales)
  ctx.fillStyle = NEON.amber;
  for (let x = 8; x < width; x += 24) {
    const inI1 = x > i1X - halfRoadW - 6 && x < i1X + halfRoadW + 6;
    const inI2 = x > i2X - halfRoadW - 6 && x < i2X + halfRoadW + 6;
    if (!inI1 && !inI2) {
      ctx.fillRect(x, centerY - 2, 12, 4);
    }
  }
  for (let y = 44; y < height; y += 22) {
    if (y < centerY - halfRoadH - 6 || y > centerY + halfRoadH + 6) {
      ctx.fillRect(i1X - 2, y, 4, 11);
      ctx.fillRect(i2X - 2, y, 4, 11);
    }
  }

  // Líneas blancas de parada + Pasos de cebra (crosswalks) en I1 e I2
  ctx.fillStyle = 'rgba(230, 237, 247, 0.45)';
  for (const ix of [i1X, i2X]) {
    for (let s = -halfRoadH + 6; s < halfRoadH - 6; s += 10) {
      ctx.fillRect(ix - halfRoadW - 10, centerY + s, 7, 5);
      ctx.fillRect(ix + halfRoadW + 3, centerY + s, 7, 5);
    }
    for (let s = -halfRoadW + 6; s < halfRoadW - 6; s += 10) {
      ctx.fillRect(ix + s, centerY - halfRoadH - 10, 5, 7);
      ctx.fillRect(ix + s, centerY + halfRoadH + 3, 5, 7);
    }
  }
  // Líneas de detención blancas frente a cada paso de cebra (respetando sentidos reales del mapa de Sopocachi)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  // Horizontales: C. Pedro Salazar (Oeste -> Este) y Retorno Belisario Salinas (Este -> Oeste)
  ctx.fillRect(i1X - halfRoadW - 15, centerY + 3, 3, halfRoadH - 5);
  ctx.fillRect(i2X - halfRoadW - 15, centerY + 3, 3, halfRoadH - 5);
  ctx.fillRect(i2X + halfRoadW + 12, centerY - halfRoadH + 2, 3, halfRoadH - 5);
  ctx.fillRect(i1X + halfRoadW + 12, centerY - halfRoadH + 2, 3, halfRoadH - 5);
  // Verticales reales: Av. 20 de Octubre sube (Sur -> Norte, línea al sur de I1) y Av. 6 de Agosto baja (Norte -> Sur, línea al norte de I2)
  ctx.fillRect(i1X + 3, centerY + halfRoadH + 12, halfRoadW - 5, 3);
  ctx.fillRect(i2X - halfRoadW + 2, centerY - halfRoadH - 15, halfRoadW - 5, 3);

  // Nombres de calles orientados A LO LARGO DE CADA VÍA (horizontal en horizontales, vertical en verticales)
  const midX = Math.round((i1X + i2X) / 2);
  const westMidX = Math.round((i1X - halfRoadW) / 2);
  const eastMidX = Math.round((i2X + halfRoadW + width) / 2);
  const northMidY = Math.round((belisarioBottom + (centerY - halfRoadH)) / 2);
  const southMidY = Math.round((centerY + halfRoadH + height) / 2);

  // Calle horizontal superior: C. Belisario Salinas (borde norte de Plaza Avaroa)
  drawStreetNameAlongRoad(
    ctx,
    midX,
    belisarioMidY,
    compact ? '← C. BELISARIO SALINAS ←' : '← C. BELISARIO SALINAS (HACIA PLAZA AVAROA) ←',
    0,
    NEON.green,
    compact
  );
  drawStreetNameAlongRoad(
    ctx,
    westMidX,
    belisarioMidY,
    compact ? '← BELISARIO SALINAS' : '← C. BELISARIO SALINAS',
    0,
    NEON.green,
    compact
  );

  // Avenida Horizontal Principal: C. Pedro Salazar (nombres en horizontal a lo largo de la vía)
  drawStreetNameAlongRoad(
    ctx,
    westMidX,
    centerY - Math.round(halfRoadH * 0.52),
    compact ? 'C. PEDRO SALAZAR →' : 'C. PEDRO SALAZAR (F1) →',
    0,
    NEON.cyan,
    compact
  );
  drawStreetNameAlongRoad(
    ctx,
    eastMidX,
    centerY + Math.round(halfRoadH * 0.52),
    compact ? '← C. PEDRO SALAZAR' : '← C. PEDRO SALAZAR (F1)',
    0,
    NEON.cyan,
    compact
  );
  drawStreetNameAlongRoad(
    ctx,
    midX,
    centerY - Math.round(halfRoadH * 0.52),
    compact ? '← R21 · HACIA P. AVAROA ←' : '← R21 · 6 AGO → 20 OCT / P. AVAROA ←',
    0,
    '#7cefff',
    compact
  );
  drawStreetNameAlongRoad(
    ctx,
    midX,
    centerY + Math.round(halfRoadH * 0.52),
    compact ? '→ R12 · PEDRO SALAZAR →' : '→ R12 · C. PEDRO SALAZAR (20 OCT → 6 AGO) →',
    0,
    '#7cefff',
    compact
  );

  // Avenidas Verticales (nombres rotados EN VERTICAL a lo largo de cada avenida, respetando sentidos reales)
  drawStreetNameAlongRoad(
    ctx,
    i1X - Math.round(halfRoadW * 0.48),
    northMidY,
    compact ? '↑ AV. 20 OCT ↑' : '↑ AV. 20 DE OCTUBRE ↑',
    -Math.PI / 2,
    NEON.amber,
    compact
  );
  drawStreetNameAlongRoad(
    ctx,
    i1X - Math.round(halfRoadW * 0.48),
    southMidY,
    compact ? '↑ 20 DE OCTUBRE ↑' : '↑ AV. 20 DE OCTUBRE (F2) ↑',
    -Math.PI / 2,
    NEON.amber,
    compact
  );
  drawStreetNameAlongRoad(
    ctx,
    i2X + Math.round(halfRoadW * 0.48),
    northMidY,
    compact ? '↓ 6 DE AGOSTO ↓' : '↓ AV. 6 DE AGOSTO (F2) ↓',
    -Math.PI / 2,
    NEON.amber,
    compact
  );
  drawStreetNameAlongRoad(
    ctx,
    i2X + Math.round(halfRoadW * 0.48),
    southMidY,
    compact ? '↓ AV. 6 AGOSTO ↓' : '↓ AV. 6 DE AGOSTO ↓',
    -Math.PI / 2,
    NEON.amber,
    compact
  );

  // 4. Barras neón de ocupación de tramos R12 y R21 (0–24 veh)
  const barW = Math.max(150, Math.min(230, i2X - i1X - roadW - 36));
  drawLinkBar(
    ctx,
    midX - Math.round(barW / 2),
    centerY - halfRoadH - 30,
    barW,
    18,
    'R21',
    world.links.R21,
    linkCapacity,
    saturationThreshold
  );
  drawLinkBar(
    ctx,
    midX - Math.round(barW / 2),
    centerY + halfRoadH + 14,
    barW,
    18,
    'R12',
    world.links.R12,
    linkCapacity,
    saturationThreshold
  );

  // 5. Vehículos pixel-art (con sprites automáticos o fallback procedural)
  const carKeys: readonly CanonicalSpriteKey[] = ['car_cyan', 'car_yellow', 'car_pink'];
  const carLen = compact ? 22 : 26;
  const carWid = compact ? 13 : 15;
  const halfCarLen = Math.round(carLen / 2);

  // Hitos de mapeo sincronizados exactamente con simulator.ts
  const hKnots = [0, 0.21, 0.36, 0.63, 0.78, 1] as const;
  const vKnots = [0, 0.34, 0.64, 1] as const;

  const i1F1Values = [
    -26,
    i1X - halfRoadW - 17 - halfCarLen,
    i1X + halfRoadW + 14 + halfCarLen,
    i2X - halfRoadW - 17 - halfCarLen,
    i2X + halfRoadW + 14 + halfCarLen,
    width + 26,
  ] as const;

  const i2F1Values = [
    width + 26,
    i2X + halfRoadW + 17 + halfCarLen,
    i2X - halfRoadW - 14 - halfCarLen,
    i1X + halfRoadW + 17 + halfCarLen,
    i1X - halfRoadW - 14 - halfCarLen,
    -26,
  ] as const;

  // Av. 20 de Octubre (I1-F2): sube de Sur a Norte (↑) bordeando Plaza Avaroa
  const i1F2Values = [
    height + 26,
    centerY + halfRoadH + 17 + halfCarLen,
    centerY - halfRoadH - 14 - halfCarLen,
    38,
  ] as const;

  // Av. 6 de Agosto (I2-F2): baja de Norte a Sur (↓) hacia Macario Pinilla
  const i2F2Values = [
    38,
    centerY - halfRoadH - 17 - halfCarLen,
    centerY + halfRoadH + 14 + halfCarLen,
    height + 26,
  ] as const;

  for (const car of cars) {
    let x: number;
    let y: number;
    let angle: number;

    if (car.approach === 'I1-F1') {
      x = mapPiecewise(car.progress, hKnots, i1F1Values);
      y = centerY + Math.round(halfRoadH * 0.5) + (car.laneIndex === 0 ? -2 : 2);
      angle = 0;
    } else if (car.approach === 'I2-F1') {
      x = mapPiecewise(car.progress, hKnots, i2F1Values);
      y = centerY - Math.round(halfRoadH * 0.5) + (car.laneIndex === 0 ? -2 : 2);
      angle = Math.PI;
    } else if (car.approach === 'I1-F2') {
      // Av. 20 de Octubre: Sur -> Norte (↑)
      x = i1X + Math.round(halfRoadW * 0.45) + (car.laneIndex === 0 ? -2 : 2);
      y = mapPiecewise(car.progress, vKnots, i1F2Values);
      angle = -Math.PI / 2;
    } else {
      // Av. 6 de Agosto: Norte -> Sur (↓)
      x = i2X - Math.round(halfRoadW * 0.45) + (car.laneIndex === 0 ? -2 : 2);
      y = mapPiecewise(car.progress, vKnots, i2F2Values);
      angle = Math.PI / 2;
    }

    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);

    const carSprite = useSprites ? spriteManager.getImage(carKeys[car.colorVariant]) : null;
    if (carSprite) {
      // Sprite pixel-art orientado a la derecha
      ctx.drawImage(carSprite, -Math.round(carLen / 2) - 4, -Math.round(carWid / 2) - 4, carLen + 8, carWid + 8);
      // Faros delanteros y freno neón encima del sprite para legibilidad nocturna
      ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
      ctx.fillRect(Math.round(carLen / 2), -Math.round(carWid / 2) + 1, 8, carWid - 2);
      if (car.stopped) {
        ctx.fillStyle = '#ff0055';
        ctx.fillRect(-Math.round(carLen / 2) - 2, -Math.round(carWid / 2) + 2, 3, carWid - 4);
      }
    } else {
      drawProceduralCar(ctx, car.colorVariant, car.stopped, carLen, carWid);
    }
    ctx.restore();
  }

  // 6. Semáforos pixelados PERPENDICULARES a la vía que controlan:
  //    - C. Pedro Salazar horizontal (I1-F1, I2-F1) => Semáforo VERTICAL
  //    - Av. 20 de Octubre / Av. 6 de Agosto vertical (I1-F2, I2-F2) => Semáforo HORIZONTAL
  const i1F1Color = getApproachLightColor(world.phaseI1, true);
  const i1F2Color = getApproachLightColor(world.phaseI1, false);
  const i2F1Color = getApproachLightColor(world.phaseI2, true);
  const i2F2Color = getApproachLightColor(world.phaseI2, false);

  drawTrafficLightUnit(
    ctx,
    i1X - halfRoadW - 26,
    centerY + halfRoadH + 26,
    i1F1Color,
    world.remainingPhaseI1,
    'I1-F1',
    'vertical'
  );
  drawTrafficLightUnit(
    ctx,
    i1X + halfRoadW + 34,
    centerY + halfRoadH + 22,
    i1F2Color,
    world.remainingPhaseI1,
    'I1-F2',
    'horizontal'
  );
  drawTrafficLightUnit(
    ctx,
    i2X + halfRoadW + 26,
    centerY - halfRoadH - 26,
    i2F1Color,
    world.remainingPhaseI2,
    'I2-F1',
    'vertical'
  );
  drawTrafficLightUnit(
    ctx,
    i2X - halfRoadW - 34,
    centerY - halfRoadH - 28,
    i2F2Color,
    world.remainingPhaseI2,
    'I2-F2',
    'horizontal'
  );

  // 7. Etiquetas de colas en los 4 accesos (ubicadas en las aceras sin tapar Plaza Avaroa ni nombres de calles)
  drawQueueBadge(ctx, Math.max(54, i1X - halfRoadW - 92), centerY + halfRoadH + 22, 'I1-F1', world.queues['I1-F1']);
  drawQueueBadge(ctx, Math.max(54, i1X - halfRoadW - 56), height - 20, 'I1-F2', world.queues['I1-F2']);
  drawQueueBadge(ctx, Math.min(width - 54, i2X + halfRoadW + 92), centerY - halfRoadH - 22, 'I2-F1', world.queues['I2-F1']);
  drawQueueBadge(ctx, Math.min(width - 54, i2X + halfRoadW + 56), belisarioBottom + 20, 'I2-F2', world.queues['I2-F2']);

  // 8. Nombres de las intersecciones en el centro
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('I1 · 20 OCT', i1X, centerY - 6);
  ctx.fillStyle = NEON.cyan;
  ctx.font = 'bold 8px "JetBrains Mono", monospace';
  ctx.fillText('P. SALAZAR', i1X, centerY + 7);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.fillText('I2 · 6 AGO', i2X, centerY - 6);
  ctx.fillStyle = NEON.cyan;
  ctx.font = 'bold 8px "JetBrains Mono", monospace';
  ctx.fillText('P. SALAZAR', i2X, centerY + 7);

  // 9. Barra superior HUD del Canvas (identidad del controlador y plan vigente)
  const accent = mode === 'smart' ? NEON.cyan : NEON.amber;
  ctx.fillStyle = '#0d1022';
  ctx.fillRect(0, 0, width, 36);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 34, width, 2);

  // Pulso neón indicador vivo
  const pulse = 0.65 + 0.35 * Math.sin(timeSeconds * 5);
  ctx.fillStyle = accent;
  ctx.globalAlpha = pulse;
  ctx.fillRect(10, 12, 10, 10);
  ctx.globalAlpha = 1;

  ctx.fillStyle = accent;
  ctx.font = compact ? 'bold 10px "JetBrains Mono", monospace' : 'bold 12px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const titleText =
    mode === 'smart'
      ? 'AGENTE SMARTTRAFFIC (PODA α-β + PSR)'
      : 'SEMÁFORO CONVENCIONAL (TIEMPO FIJO)';
  ctx.fillText(titleText, 28, 17);

  ctx.fillStyle = NEON.white;
  ctx.textAlign = 'right';
  ctx.font = compact ? 'bold 10px "JetBrains Mono", monospace' : 'bold 11px "JetBrains Mono", monospace';
  const planText = `I1:${world.plan.g11}s/${world.plan.g12}s  I2:${world.plan.g21}s/${world.plan.g22}s  |  t=${Math.floor(world.elapsedInCycle)}s/70s`;
  ctx.fillText(planText, width - 12, 17);
}
