export const icons={
 upload:'<path d="M12 16V3m0 0L7 8m5-5 5 5M4 16v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
 shrink:'<path d="m8 3-5 5m0-5v5h5m8 13 5-5m0 5v-5h-5M3 15h6v6m12-18h-6v6"/>',
 resize:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m8 16 8-8M10 8h6v6"/>',
 convert:'<path d="M4 8h16m0 0-4-4m4 4-4 4M20 16H4m0 0 4-4m-4 4 4 4"/>',
 shield:'<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 file:'<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"/><path d="M14 2v6h6"/>'
};
export function svg(icon, size=24){return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${icons[icon]||icons.image}</svg>`}
