// Colores de interfaz compartidos por Cliente y Espectador, para que el mismo
// concepto se vea igual en todas partes.

import { PALETTE } from "./sprites.js";

/** Color de cada parte de una línea del aviso de eliminaciones. */
export const KILL_ROLE_COLORS = { killer: PALETTE.accent, sep: "#ef5350", victim: PALETTE.text, streak: "#ff9800" };

/** Color de cada efecto: lo usan el aviso al recoger la Caja y la insignia del HUD. */
export const EFFECT_COLORS = { turbo: "#ffca28", ralentizar: "#90a4ae", escudo: "#4fc3f7" };
