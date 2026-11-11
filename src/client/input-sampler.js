// Agrupación de Inputs del Cliente_Juego por Intervalo de envío. Puro, sin DOM.
// Acumula los cambios de teclas, disparo y ángulo y, al hacer flush(), devuelve
// como máximo un Input con el estado más reciente, sin perder pulsaciones que
// cambiaron y volvieron dentro del mismo intervalo.

/** @typedef {{ w, a, s, d, fire: boolean, aim: number }} Input */

const BUTTONS = ["w", "a", "s", "d", "fire"];

export function createInputSampler() {
  const current = { w: false, a: false, s: false, d: false, fire: false, aim: 0 };
  let lastSent = { ...current };
  let haveSent = false;
  // Para cada botón, si cambió durante el intervalo (para no perder toques breves).
  const toggled = { w: false, a: false, s: false, d: false, fire: false };
  // Input de seguimiento pendiente del intervalo anterior.
  let pendingFollowUp = null;

  function setKey(k, down) {
    if (k !== "w" && k !== "a" && k !== "s" && k !== "d") return;
    if (current[k] !== down) toggled[k] = true;
    current[k] = down;
  }

  function setFire(down) {
    if (current.fire !== down) toggled.fire = true;
    current.fire = down;
  }

  function setAim(angle) {
    current.aim = angle;
  }

  function releaseAll() {
    for (const b of ["w", "a", "s", "d", "fire"]) {
      if (current[b]) toggled[b] = true;
      current[b] = false;
    }
  }

  function equalButtons(a, b) {
    return BUTTONS.every((k) => a[k] === b[k]) && a.aim === b.aim;
  }

  function clearToggles() {
    for (const b of Object.keys(toggled)) toggled[b] = false;
  }

  /** @returns {Input | null} */
  function flush() {
    // 1) Input de seguimiento pendiente.
    if (pendingFollowUp) {
      const out = pendingFollowUp;
      pendingFollowUp = null;
      lastSent = { ...out };
      haveSent = true;
      clearToggles();
      return out;
    }

    const changed = !haveSent || !equalButtons(current, lastSent);

    if (changed) {
      const out = { ...current };
      lastSent = { ...current };
      haveSent = true;
      clearToggles();
      return out;
    }

    // current == lastSent pero algún botón cambió y volvió durante el intervalo.
    const anyToggled = BUTTONS.some((b) => b !== "aim" && toggled[b]);
    if (anyToggled) {
      const inverted = { ...lastSent };
      for (const b of ["w", "a", "s", "d", "fire"]) {
        if (toggled[b]) inverted[b] = !inverted[b];
      }
      // Dejar pendiente un seguimiento con el estado actual.
      pendingFollowUp = { ...current };
      clearToggles();
      return inverted;
    }

    // Sin cambios.
    return null;
  }

  return { setKey, setFire, setAim, releaseAll, flush };
}
