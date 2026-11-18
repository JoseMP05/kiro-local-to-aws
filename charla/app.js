// Rama del repositorio con el juego terminado: se edita en data-branch de #resultado.
// (El HTML ya trae "main" por defecto, así que sin JavaScript también funciona.)
const REPO_URL = "https://github.com/JoseMP05/kiro-local-to-aws";

document.documentElement.classList.add("js");

// Rama configurable
const resultado = document.getElementById("resultado");
if (resultado) {
  const branch = resultado.dataset.branch || "main";
  resultado.querySelectorAll("[data-branch-text]").forEach((el) => { el.textContent = branch; });
  resultado.querySelectorAll("[data-branch-link]").forEach((a) => { a.href = `${REPO_URL}/tree/${encodeURIComponent(branch)}`; });
}

// Botones de copiar: Clipboard API y, si falla, selecciona el texto para copiarlo a mano
document.querySelectorAll("button.copy").forEach((btn) => {
  const label = btn.textContent;
  btn.addEventListener("click", async () => {
    const pre = btn.closest(".codeblock").querySelector("pre");
    const text = pre.textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Copiado";
      btn.classList.add("done");
      setTimeout(() => { btn.textContent = label; btn.classList.remove("done"); }, 1800);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      btn.textContent = "Selecciona y copia";
    }
  });
});

// Pestañas accesibles (Requirements / Design / Tasks)
document.querySelectorAll("[data-tabs]").forEach((root) => {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
  const select = (i, focus) => {
    tabs.forEach((t, k) => {
      const on = k === i;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      panels[k].hidden = !on;
    });
    if (focus) tabs[i].focus();
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(i));
    t.addEventListener("keydown", (e) => {
      const keys = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in keys)) return;
      e.preventDefault();
      select((keys[e.key] + tabs.length) % tabs.length, true);
    });
  });
  select(0);
});

// Marca la sección visible en el índice
const links = [...document.querySelectorAll("nav.toc a")];
const byId = new Map(links.map((a) => [a.hash.slice(1), a]));
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.removeAttribute("aria-current"));
      byId.get(e.target.id)?.setAttribute("aria-current", "true");
    });
  }, { rootMargin: "-20% 0px -70% 0px" });
  byId.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
}
