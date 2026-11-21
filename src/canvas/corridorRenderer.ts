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
  useSprites: boolean
): void {
  const glowColor =
    color === 'green' ? NEON.green : color === 'yellow' ? NEON.amber : NEON.pink;

  // Halo neón
  ctx.save();
  ctx.fillStyle = glowColor;
  ctx.globalAlpha = 0.22;
  ctx.fillRect(x - 14, y - 22, 28, 44);
  ctx.globalAlpha = 1;

  // Caja del semáforo pixelado
  ctx.fillStyle = '#090a14';
  ctx.fillRect(x - 10, y - 19, 20, 38);
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 10, y - 19, 20, 38);

  const spriteLightKey =
    color === 'green' ? 'light_green' : color === 'yellow' ? 'light_yellow' : 'light_red';
  const lightImg = useSprites ? spriteManager.getImage(spriteLightKey) : null;
  const housingImg = useSprites ? spriteManager.getImage('traffic_light') : null;

  if (lightImg) {
    ctx.drawImage(lightImg, x - 8, y - 16, 16, 32);
  } else if (housingImg) {
    ctx.drawImage(housingImg, x - 9, y - 17, 18, 34);
    ctx.fillStyle = glowColor;
    ctx.fillRect(x - 3, color === 'red' ? y - 12 : color === 'yellow' ? y - 3 : y + 6, 6, 6);
  } else {
    // 3 luces pixeladas
    ctx.fillStyle = color === 'red' ? NEON.pink : '#2d1220';
    ctx.fillRect(x - 4, y - 14, 8, 8);
    ctx.fillStyle = color === 'yellow' ? NEON.amber : '#2e2510';
    ctx.fillRect(x - 4, y - 4, 8, 8);
    ctx.fillStyle = color === 'green' ? NEON.green : '#102e14';
    ctx.fillRect(x - 4, y + 6, 8, 8);
  }

  // Etiqueta y cuenta regresiva en segundos exactos
  ctx.fillStyle = '#090a14';
  ctx.fillRect(x - 18, y + 22, 36, 15);
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 18, y + 22, 36, 15);

  ctx.fillStyle = glowColor;
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${countdown}s`, x, y + 30);

  ctx.fillStyle = NEON.muted;
  ctx.font = 'bold 9px "JetBrains Mono", monospace';
  ctx.fillText(label, x, y - 26);

  ctx.restore();
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
  ctx.fillRect(x - 42, y - 11, 84, 22);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 42, y - 11, 84, 22);

  ctx.fillStyle = color;
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${label}: ${queueValue.toFixed(1)}`, x, y);
}

/**
 * Renderizador principal del corredor Pérez Velasco (I1) — Acceso Autopista / Av. Montes (I2)
 * en HTML5 Canvas 2D con estilo Retro Pixel-Art Neón y soporte automático para sprites.
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

  // Geometría proporcional
  const roadH = compact ? 76 : 92;
  const roadW = compact ? 72 : 84;
  const centerY = Math.round(height * 0.54);
  const i1X = Math.round(width * 0.28);
  const i2X = Math.round(width * 0.72);
  const halfRoadH = Math.round(roadH / 2);
  const halfRoadW = Math.round(roadW / 2);

  // 2. Edificios pixel-art urbanos (La Paz nocturno)
  const bPad = 14;
  drawPixelBuilding(ctx, bPad, 44, i1X - halfRoadW - bPad * 2, centerY - halfRoadH - 58, NEON.cyan, 1);
  drawPixelBuilding(
    ctx,
    i1X + halfRoadW + bPad,
    44,
    i2X - i1X - roadW - bPad * 2,
    Math.max(36, centerY - halfRoadH - 86),
    NEON.amber,
    2
  );
  drawPixelBuilding(
    ctx,
    i2X + halfRoadW + bPad,
    44,
    width - (i2X + halfRoadW) - bPad * 2,
    centerY - halfRoadH - 58,
    NEON.pink,
    3
  );
  drawPixelBuilding(
    ctx,
    bPad,
    centerY + halfRoadH + bPad,
    i1X - halfRoadW - bPad * 2,
    height - (centerY + halfRoadH) - bPad * 2,
    NEON.green,
    4
  );
  drawPixelBuilding(
    ctx,
    i1X + halfRoadW + bPad,
    centerY + halfRoadH + 34,
    i2X - i1X - roadW - bPad * 2,
    Math.max(32, height - (centerY + halfRoadH) - 48),
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

  // Asfalto base horizontal y vertical
  ctx.fillStyle = NEON.asphalt;
  ctx.fillRect(0, centerY - halfRoadH, width, roadH);
  ctx.fillRect(i1X - halfRoadW, 38, roadW, height - 38);
  ctx.fillRect(i2X - halfRoadW, 38, roadW, height - 38);

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

  // Bordes neón de las calzadas
  ctx.fillStyle = NEON.asphaltEdge;
  ctx.fillRect(0, centerY - halfRoadH - 2, width, 2);
  ctx.fillRect(0, centerY + halfRoadH, width, 2);
  ctx.fillRect(i1X - halfRoadW - 2, 38, 2, height - 38);
  ctx.fillRect(i1X + halfRoadW, 38, 2, height - 38);
  ctx.fillRect(i2X - halfRoadW - 2, 38, 2, height - 38);
  ctx.fillRect(i2X + halfRoadW, 38, 2, height - 38);

  // Cajas de intersección limpias
  ctx.fillStyle = '#1b223d';
  ctx.fillRect(i1X - halfRoadW, centerY - halfRoadH, roadW, roadH);
  ctx.fillRect(i2X - halfRoadW, centerY - halfRoadH, roadW, roadH);

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

  // Pasos de cebra (crosswalks) en I1 e I2
  ctx.fillStyle = 'rgba(230, 237, 247, 0.42)';
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

  // Flechas de dirección en los tramos conectores R12 (Este) y R21 (Oeste)
  const midX = Math.round((i1X + i2X) / 2);
  ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
  ctx.font = 'bold 11px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('<<< R21 (I2 → I1) <<<', midX, centerY - Math.round(halfRoadH / 2));
  ctx.fillText('>>> R12 (I1 → I2) >>>', midX, centerY + Math.round(halfRoadH / 2));

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

  for (const car of cars) {
    let x: number;
    let y: number;
    let angle: number;

    if (car.approach === 'I1-F1') {
      // Oeste -> Este pasando por I1 hacia R12
      const startX = -16;
      const endX = midX + 36;
      x = startX + car.progress * (endX - startX);
      y = centerY + Math.round(halfRoadH * 0.5) + (car.laneIndex === 0 ? -4 : 5);
      angle = 0;
    } else if (car.approach === 'I2-F1') {
      // Este -> Oeste pasando por I2 hacia R21
      const startX = width + 16;
      const endX = midX - 36;
      x = startX + car.progress * (endX - startX);
      y = centerY - Math.round(halfRoadH * 0.5) + (car.laneIndex === 0 ? -5 : 4);
      angle = Math.PI;
    } else if (car.approach === 'I1-F2') {
      // Norte -> Sur cruzando I1
      const startY = 38;
      const endY = height + 16;
      x = i1X - Math.round(halfRoadW * 0.42) + (car.laneIndex === 0 ? -3 : 6);
      y = startY + car.progress * (endY - startY);
      angle = Math.PI / 2;
    } else {
      // Sur -> Norte cruzando I2
      const startY = height + 16;
      const endY = 38;
      x = i2X + Math.round(halfRoadW * 0.42) + (car.laneIndex === 0 ? -6 : 3);
      y = startY + car.progress * (endY - startY);
      angle = -Math.PI / 2;
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

  // 6. Semáforos pixelados con halo neón y cuenta regresiva exacta
  const i1F1Color = getApproachLightColor(world.phaseI1, true);
  const i1F2Color = getApproachLightColor(world.phaseI1, false);
  const i2F1Color = getApproachLightColor(world.phaseI2, true);
  const i2F2Color = getApproachLightColor(world.phaseI2, false);

  drawTrafficLightUnit(
    ctx,
    i1X - halfRoadW - 26,
    centerY + halfRoadH + 24,
    i1F1Color,
    world.remainingPhaseI1,
    'I1-F1',
    useSprites
  );
  drawTrafficLightUnit(
    ctx,
    i1X + halfRoadW + 26,
    centerY - halfRoadH - 26,
    i1F2Color,
    world.remainingPhaseI1,
    'I1-F2',
    useSprites
  );
  drawTrafficLightUnit(
    ctx,
    i2X + halfRoadW + 26,
    centerY - halfRoadH - 26,
    i2F1Color,
    world.remainingPhaseI2,
    'I2-F1',
    useSprites
  );
  drawTrafficLightUnit(
    ctx,
    i2X - halfRoadW - 26,
    centerY + halfRoadH + 24,
    i2F2Color,
    world.remainingPhaseI2,
    'I2-F2',
    useSprites
  );

  // 7. Etiquetas de colas en los 4 accesos
  drawQueueBadge(ctx, Math.max(58, i1X - halfRoadW - 76), centerY + halfRoadH - 18, 'I1-F1', world.queues['I1-F1']);
  drawQueueBadge(ctx, i1X, 62, 'I1-F2', world.queues['I1-F2']);
  drawQueueBadge(ctx, Math.min(width - 58, i2X + halfRoadW + 76), centerY - halfRoadH + 18, 'I2-F1', world.queues['I2-F1']);
  drawQueueBadge(ctx, i2X, height - 20, 'I2-F2', world.queues['I2-F2']);

  // 8. Nombres de las intersecciones en el centro
  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('I1', i1X, centerY - 6);
  ctx.fillStyle = NEON.cyan;
  ctx.font = 'bold 8px "JetBrains Mono", monospace';
  ctx.fillText('P. VELASCO', i1X, centerY + 7);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.font = 'bold 10px "JetBrains Mono", monospace';
  ctx.fillText('I2', i2X, centerY - 6);
  ctx.fillStyle = NEON.cyan;
  ctx.font = 'bold 8px "JetBrains Mono", monospace';
  ctx.fillText('AV. MONTES', i2X, centerY + 7);

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
