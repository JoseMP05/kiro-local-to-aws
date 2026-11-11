// Cámara del Cliente_Juego. Puro, sin DOM. Trabaja en píxeles CSS;
// devicePixelRatio lo aplica render.js. Muestra un Área_Visible fija en
// unidades de Arena, con Franjas iguales a ambos lados cuando la proporción del
// Canvas no coincide.

import { clampWindow } from "../shared/math.js";

/**
 * @param {{ w: number, h: number }} canvas tamaño del Canvas en px CSS
 * @param {{ w: number, h: number }} view Área_Visible en unidades de Arena
 * @param {{ w: number, h: number }} arena
 * @param {{ x: number, y: number }} focus centro del Tanque propio (o posición al morir)
 */
export function computeCamera(canvas, view, arena, focus) {
  const scale = Math.min(canvas.w / view.w, canvas.h / view.h);
  const ox = (canvas.w - view.w * scale) / 2;
  const oy = (canvas.h - view.h * scale) / 2;
  const originX = clampWindow(focus.x, view.w, arena.w).lo;
  const originY = clampWindow(focus.y, view.h, arena.h).lo;
  return {
    scale, ox, oy, originX, originY,
    viewW: view.w, viewH: view.h, canvasW: canvas.w, canvasH: canvas.h,
  };
}

export const worldToScreen = (c, x, y) => ({
  x: c.ox + (x - c.originX) * c.scale,
  y: c.oy + (y - c.originY) * c.scale,
});

export const screenToWorld = (c, sx, sy) => ({
  x: (sx - c.ox) / c.scale + c.originX,
  y: (sy - c.oy) / c.scale + c.originY,
});

export function visibleWorldRect(c, arena) {
  return {
    left: Math.max(0, c.originX),
    top: Math.max(0, c.originY),
    right: Math.min(arena.w, c.originX + c.viewW),
    bottom: Math.min(arena.h, c.originY + c.viewH),
  };
}
