/**
 * Tarot card artwork, drawn as SVG and used as data-URI backgrounds.
 * Sand frame with indigo ink, a mauve star-chart panel, and a desert ridge.
 * The back also carries a Santa hat on the mountain peak and the title banner.
 */

const IND = "#2f2470";
const SAND = "#dcc092";
const SANDL = "#ecd9b2";
const MAU = "#8b7274";
const MAUD = "#6a5560";
const WH = "#fffaf0";

export const CARD_RATIO = 1.65;

function sparkle(x: number, y: number, s: number, o = 1): string {
  return `<path d='M${x} ${y - s} Q${x} ${y} ${x + s * 0.4} ${y} Q${x} ${y} ${x} ${y + s} Q${x} ${y} ${x - s * 0.4} ${y} Q${x} ${y} ${x} ${y - s}Z' fill='${WH}' opacity='${o}'/>`;
}

function starChart(): string {
  const cx = 97;
  const cy = 8;
  const at = (r: number, deg: number): [number, number] => [
    cx + Math.cos((deg * Math.PI) / 180) * r,
    cy + Math.sin((deg * Math.PI) / 180) * r,
  ];
  let out = "";
  for (const [r, dashed] of [[34, 0], [56, 1], [80, 0], [104, 1], [130, 0]] as const) {
    out += `<circle cx='${cx}' cy='${cy}' r='${r}' fill='none' stroke='${SAND}' stroke-width='${dashed ? 0.8 : 1}' ${dashed ? "stroke-dasharray='12 2.5 2 2.5'" : ""}/>`;
  }
  for (const deg of [104, 122, 141, 160]) {
    const [x, y] = at(220, deg);
    out += `<line x1='${cx}' y1='${cy}' x2='${x.toFixed(1)}' y2='${y.toFixed(1)}' stroke='${SAND}' stroke-width='.7'/>`;
  }
  const dots: [number, number, number][] = [
    [34, 160, 2.8], [56, 118, 2.4], [56, 123, 1.7], [56, 127, 1.2], [80, 148, 2.6],
    [104, 112, 2.2], [104, 116.5, 1.6], [104, 120, 1.1], [130, 138, 2.4], [130, 141.5, 1.6],
  ];
  for (const [r, deg, size] of dots) {
    const [x, y] = at(r, deg);
    out += `<circle cx='${x.toFixed(1)}' cy='${y.toFixed(1)}' r='${size}' fill='${SAND}'/>`;
  }
  return out;
}

const CORNER = `<path d='M1.6 36 C1.6 19 7 7.5 22 2.6' fill='none' stroke='${IND}' stroke-width='2.3' stroke-linecap='round'/>
<path d='M5.4 46 C5 27 11 15 30 9.6' fill='none' stroke='${IND}' stroke-width='1.1' stroke-linecap='round'/>
<path d='M8 27 C11 15.5 19 10.5 31 9.2 C24 13 17.5 17.5 13.5 27.5 C11.6 31 9 30.5 8 27Z' fill='${SANDL}' stroke='${IND}' stroke-width='.9'/>
<path d='M22 2.6 C26.5 1 30.5 3.2 28.6 6.2 C27 8.4 24.2 7.4 24.8 5.6' fill='none' stroke='${IND}' stroke-width='1.3' stroke-linecap='round'/>
<path d='M1.6 36 C-.2 41 1 46.5 4.2 48.5' fill='none' stroke='${IND}' stroke-width='1.6' stroke-linecap='round'/>`;

const VINE = `<path d='M2.6 60 C6 71 .6 84 3.6 97 C6 107 2 115 4.2 124' fill='none' stroke='${IND}' stroke-width='1.1' stroke-linecap='round'/>`;

const CARTOUCHE_STAR = `<path d='M50 6.6 Q50 10.4 51.3 10.4 Q50 10.4 50 14.2 Q50 10.4 48.7 10.4 Q50 10.4 50 6.6Z' fill='${IND}'/>`;

function artwork(kind: "back" | "front"): string {
  if (kind === "back") {
    let art = sparkle(48, 60, 23);
    art += `<g transform='translate(48 60)' fill='${WH}'>${[0, 45, 90, 135]
      .map((a) => `<path d='M0 -7 L1.3 0 L0 7 L-1.3 0Z' transform='rotate(${a + 22.5})'/>`)
      .join("")}<circle r='3'/></g>`;
    art += sparkle(26, 46, 7) + sparkle(72, 40, 6) + sparkle(21, 90, 6) + sparkle(76, 96, 8);
    art += sparkle(36, 104, 4.5) + sparkle(63, 112, 5) + sparkle(27, 72, 3.5) + sparkle(80, 64, 3.5, 0.8);
    art += `<path d='M9 139 L9 127 L22 116 L30 121 L45 103 L57 117 L65 112 L91 131 L91 139 Z' fill='${MAUD}' stroke='${IND}' stroke-width='.9'/>`;
    art += `<path d='M45 103 L57 117 L65 112 L91 131 L91 139 L60 139 L50 118Z' fill='${IND}' opacity='.22'/>`;
    art += `<g transform='translate(45.2 103.4) rotate(-6)'><path d='M-3.6 -.3 Q-1 -8 4.8 -10 Q3.9 -5 3.4 -.4Z' fill='#c8343f' stroke='${IND}' stroke-width='.4'/><path d='M-4.3 .5 Q0 -1.6 4.3 .5' stroke='${WH}' stroke-width='2.4' stroke-linecap='round' fill='none'/><circle cx='5.2' cy='-10' r='1.7' fill='${WH}'/></g>`;
    return art;
  }
  let art = sparkle(20, 30, 6) + sparkle(81, 34, 7) + sparkle(17, 96, 5) + sparkle(84, 92, 4.5);
  art += sparkle(50, 24, 3.5, 0.9) + sparkle(27, 112, 4) + sparkle(74, 112, 5) + sparkle(14, 62, 3, 0.8) + sparkle(87, 64, 3, 0.8);
  art += `<path d='M9 139 L9 131 L20 124 L28 128 L40 117 L50 126 L60 121 L74 129 L82 125 L91 131 L91 139 Z' fill='${MAUD}' stroke='${IND}' stroke-width='.9'/>`;
  return art;
}

/** Returns a `data:` URI for one face of the card. */
export function cardArt(kind: "back" | "front"): string {
  const title =
    kind === "back"
      ? `<text x='50' y='152.9' text-anchor='middle' font-family='Oswald,Arial Narrow,Arial,sans-serif' font-size='7' fill='${IND}' textLength='44' lengthAdjust='spacingAndGlyphs'>SAHARA SANTA</text>`
      : "";
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 165'>
<defs><clipPath id='pc'><rect x='9' y='15' width='82' height='124'/></clipPath>
<radialGradient id='gl' cx='.45' cy='.4' r='.7'><stop offset='0' stop-color='#fff' stop-opacity='.14'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></radialGradient></defs>
<rect x='1.2' y='1.2' width='97.6' height='162.6' rx='3' fill='${SAND}' stroke='${IND}' stroke-width='1.6'/>
<rect x='6.8' y='12.8' width='86.4' height='128.4' fill='none' stroke='${IND}' stroke-width='.5'/>
<rect x='9' y='15' width='82' height='124' fill='${MAU}'/>
<g clip-path='url(#pc)'>${starChart()}<rect x='9' y='15' width='82' height='124' fill='url(#gl)'/>${artwork(kind)}</g>
<rect x='9' y='15' width='82' height='124' fill='none' stroke='${IND}' stroke-width='1.4'/>
${VINE}<g transform='translate(100 0) scale(-1 1)'>${VINE}</g>
${CORNER}<g transform='translate(100 0) scale(-1 1)'>${CORNER}</g><g transform='translate(0 165) scale(1 -1)'>${CORNER}</g><g transform='translate(100 165) scale(-1 -1)'>${CORNER}</g>
<path d='M35 15.6 L35 11 Q35 3.6 50 3.6 Q65 3.6 65 11 L65 15.6 Z' fill='${SAND}' stroke='${IND}' stroke-width='1.2'/>
<path d='M37.6 15.6 L37.6 11.4 Q37.6 6 50 6 Q62.4 6 62.4 11.4 L62.4 15.6' fill='none' stroke='${IND}' stroke-width='.45'/>
${CARTOUCHE_STAR}
<rect x='15' y='142' width='70' height='15.4' rx='1.8' fill='${SAND}' stroke='${IND}' stroke-width='1.2'/>
<rect x='16.8' y='143.8' width='66.4' height='11.8' rx='1' fill='none' stroke='${IND}' stroke-width='.45'/>
${title}
</svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
