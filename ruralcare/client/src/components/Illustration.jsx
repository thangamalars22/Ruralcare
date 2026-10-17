// Decorative artwork (pure SVG): a village health-centre scene for the sign-in pages, a small greeting graphic for the
// dashboard, and the ECG line used in the sidebar. Animation is disabled by prefers-reduced-motion.

// One heartbeat (P wave, QRS spike, T wave) as [dx, y] points on a 0–1000 × 0–120 canvas.
const BEAT = [[0, 60], [14, 48], [28, 60], [46, 60], [56, 34], [68, 104], [80, 8], [92, 66], [104, 60], [124, 60], [140, 46], [156, 60]];
const ECG_PATH = 'M0 60 H60 ' + [60, 380, 700]
  .map((x, i, a) => BEAT.map(([dx, y]) => `L${x + dx} ${y}`).join(' ') + (i < a.length - 1 ? ` H${a[i + 1]}` : ' H1000'))
  .join(' ');

/** Faint static ECG trace with a bright pulse travelling along it (white, for the coral sidebar). */
export function EcgLine({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 1000 120" aria-hidden="true" focusable="false">
      <path className="ecg-trace" d={ECG_PATH} pathLength="1000" />
      <path className="ecg-pulse" d={ECG_PATH} pathLength="1000" />
    </svg>
  );
}

/** Village health-centre scene used on the login / register pages. */
export default function Illustration() {
  return (
    <svg className="ill" viewBox="0 0 640 380" role="img" aria-label="A village health centre with a winding path, trees and rolling hills" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="rc-hill1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFD3C2" /><stop offset="1" stopColor="#FFC2AE" /></linearGradient>
        <linearGradient id="rc-hill2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F58B7C" /><stop offset="1" stopColor="#E96A62" /></linearGradient>
      </defs>
      <circle cx="520" cy="70" r="34" fill="#FEF3C7" />
      <path d="M0 250 C90 190 180 210 270 235 C380 262 470 200 640 232 V380 H0Z" fill="url(#rc-hill1)" />
      <path d="M0 300 C110 262 210 290 320 300 C430 310 520 270 640 292 V380 H0Z" fill="url(#rc-hill2)" />
      <path d="M250 380 C290 340 230 330 300 310 C350 296 340 280 372 268 L398 270 C372 288 392 300 346 322 C300 344 360 360 372 380Z" fill="#FFE4D6" opacity=".95" />
      {/* trees */}
      <g><rect x="92" y="226" width="7" height="30" rx="3" fill="#92602F" /><circle cx="95" cy="214" r="24" fill="#15803D" /><circle cx="80" cy="226" r="16" fill="#1E9A50" /><circle cx="112" cy="228" r="15" fill="#1E9A50" /></g>
      <g><rect x="500" y="236" width="6" height="26" rx="3" fill="#92602F" /><circle cx="503" cy="226" r="19" fill="#15803D" /><circle cx="515" cy="236" r="12" fill="#1E9A50" /></g>
      {/* health centre */}
      <g>
        <rect x="190" y="212" width="170" height="82" rx="6" fill="#FFFFFF" />
        <path d="M178 216 L275 160 L372 216Z" fill="#DC4C4C" />
        <path d="M178 216 L275 160 L372 216" fill="none" stroke="#B93838" strokeWidth="4" strokeLinejoin="round" />
        <rect x="256" y="190" width="38" height="38" rx="8" fill="#fff" />
        <rect x="271" y="196" width="8" height="26" rx="2" fill="#DC4C4C" /><rect x="262" y="205" width="26" height="8" rx="2" fill="#DC4C4C" />
        <rect x="258" y="250" width="34" height="44" rx="4" fill="#FFE4D6" /><circle cx="285" cy="273" r="2.5" fill="#B93838" />
        <rect x="206" y="236" width="36" height="30" rx="4" fill="#FDE8E7" stroke="#E7DDD5" /><rect x="308" y="236" width="36" height="30" rx="4" fill="#FDE8E7" stroke="#E7DDD5" />
        <path d="M224 236v30M206 251h36M326 236v30M308 251h36" stroke="#E7DDD5" />
      </g>
      <path d="M452 296c0-16 10-26 28-30-2 16-12 28-28 30z" fill="#15803D" opacity=".85" />
      <path d="M60 300c0-14 9-22 24-26-2 14-10 24-24 26z" fill="#15803D" opacity=".85" />
    </svg>
  );
}

/** Small greeting graphic for the dashboard banner. */
export function BannerArt({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 170 120" aria-hidden="true" focusable="false">
      <path d="M20 108c2-30 18-48 46-52-1 30-16 50-46 52z" fill="#15803D" opacity=".85" />
      <path d="M150 108c-2-30-18-48-46-52 1 30 16 50 46 52z" fill="#1E9A50" opacity=".85" />
      <rect x="52" y="14" width="66" height="88" rx="10" fill="#fff" stroke="#E7DDD5" strokeWidth="2" />
      <rect x="72" y="8" width="26" height="14" rx="5" fill="#DC4C4C" />
      <path d="M85 80S63 66 63 52c0-7 5-11 11-11 5 0 9 3 11 7 2-4 6-7 11-7 6 0 11 4 11 11 0 14-22 28-22 28z" fill="#DC4C4C" />
      <rect x="82" y="50" width="6" height="16" rx="1.5" fill="#fff" /><rect x="77" y="55" width="16" height="6" rx="1.5" fill="#fff" />
    </svg>
  );
}
