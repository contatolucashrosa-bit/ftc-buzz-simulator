// Buzz Simulator — Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Ícones desenhados para o projeto (não são assets da FIRST).

export const ICON_BRAND = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2 28 9v14l-12 7-12-7V9z" fill="#f7e326"/><path d="M16 9 22 12.5v7L16 23l-6-3.5v-7z" fill="#111"/><circle cx="16" cy="16" r="2.6" fill="#f7e326"/></svg>`;

export const ICON_ROBOT = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="11" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="9" cy="12.5" r="1.6" fill="currentColor"/><circle cx="15" cy="12.5" r="1.6" fill="currentColor"/><path d="M12 3v4M8 21v-3M16 21v-3" stroke="currentColor" stroke-width="2"/></svg>`;

/** SWARM: robôs saindo e estacionando (LEAVE + PARK). */
export const ICON_SWARM = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l3 2v4l-3 2-3-2V6zM17 4l3 2v4l-3 2-3-2V6zM12 12l3 2v4l-3 2-3-2v-4z" fill="currentColor"/></svg>`;

/** POLLINATOR: HIVE virando. */
export const ICON_POLLINATOR = (n: number) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 15 12 9l9 6" fill="none" stroke="currentColor" stroke-width="2.2"/><rect x="2" y="13" width="6" height="6" rx="1" fill="currentColor"/><rect x="16" y="5" width="6" height="6" rx="1" fill="currentColor" transform="rotate(-25 19 8)"/><text x="12" y="23" font-size="8" text-anchor="middle" font-weight="700" fill="currentColor">${n}</text></svg>`;
