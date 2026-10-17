export const HealthIllustration = () => (
  <svg viewBox="0 0 520 480" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="hsl(178 64% 50%)" />
        <stop offset="100%" stopColor="hsl(212 65% 45%)" />
      </linearGradient>
      <linearGradient id="g2" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="hsl(174 72% 88%)" />
        <stop offset="100%" stopColor="hsl(200 60% 92%)" />
      </linearGradient>
      <radialGradient id="g3" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="hsl(174 72% 80% / 0.7)" />
        <stop offset="100%" stopColor="hsl(174 72% 80% / 0)" />
      </radialGradient>
    </defs>

    {/* Glow */}
    <circle cx="260" cy="240" r="200" fill="url(#g3)" />

    {/* Decorative dots */}
    <g opacity="0.5">
      <circle cx="60" cy="80" r="3" fill="hsl(178 64% 50%)" />
      <circle cx="470" cy="120" r="4" fill="hsl(212 65% 55%)" />
      <circle cx="90" cy="380" r="3" fill="hsl(174 72% 56%)" />
      <circle cx="450" cy="400" r="4" fill="hsl(178 64% 50%)" />
    </g>

    {/* Phone / Chat device */}
    <g transform="translate(160 90)">
      <rect x="0" y="0" width="200" height="300" rx="28" fill="white" stroke="hsl(200 25% 88%)" strokeWidth="2" filter="drop-shadow(0 20px 40px hsl(212 50% 30% / 0.18))" />
      <rect x="14" y="14" width="172" height="50" rx="12" fill="url(#g1)" />
      <circle cx="38" cy="39" r="14" fill="white" opacity="0.95" />
      <path d="M32 39 L36 43 L46 33" stroke="hsl(178 64% 42%)" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="58" y="30" width="80" height="6" rx="3" fill="white" opacity="0.95" />
      <rect x="58" y="42" width="50" height="5" rx="2.5" fill="white" opacity="0.7" />

      {/* Chat bubbles */}
      <g>
        <rect x="14" y="80" width="120" height="34" rx="14" fill="hsl(200 25% 95%)">
          <animate attributeName="opacity" values="0;1" dur="0.6s" begin="0.2s" fill="freeze" />
        </rect>
        <rect x="26" y="92" width="80" height="4" rx="2" fill="hsl(210 14% 55%)" opacity="0.7" />
        <rect x="26" y="100" width="60" height="4" rx="2" fill="hsl(210 14% 55%)" opacity="0.5" />
      </g>
      <g>
        <rect x="66" y="124" width="120" height="34" rx="14" fill="url(#g1)">
          <animate attributeName="opacity" values="0;1" dur="0.6s" begin="0.6s" fill="freeze" />
        </rect>
        <rect x="78" y="136" width="80" height="4" rx="2" fill="white" opacity="0.9" />
        <rect x="78" y="144" width="60" height="4" rx="2" fill="white" opacity="0.7" />
      </g>
      <g>
        <rect x="14" y="168" width="140" height="60" rx="14" fill="hsl(200 25% 95%)">
          <animate attributeName="opacity" values="0;1" dur="0.6s" begin="1s" fill="freeze" />
        </rect>
        <rect x="26" y="180" width="100" height="4" rx="2" fill="hsl(210 14% 55%)" opacity="0.7" />
        <rect x="26" y="190" width="80" height="4" rx="2" fill="hsl(210 14% 55%)" opacity="0.5" />
        <rect x="26" y="200" width="60" height="4" rx="2" fill="hsl(210 14% 55%)" opacity="0.5" />
        <rect x="26" y="212" width="40" height="8" rx="4" fill="hsl(174 72% 56%)" opacity="0.4" />
      </g>

      {/* Input bar */}
      <rect x="14" y="248" width="172" height="38" rx="19" fill="hsl(200 25% 96%)" stroke="hsl(200 25% 90%)" />
      <circle cx="170" cy="267" r="13" fill="url(#g1)" />
      <path d="M165 267 L170 262 L175 267 M170 262 L170 273" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>

    {/* Floating heart pulse */}
    <g transform="translate(70 160)">
      <circle cx="30" cy="30" r="30" fill="white" filter="drop-shadow(0 10px 25px hsl(178 60% 35% / 0.25))" />
      <path d="M30 42 C 30 42 16 33 16 24 C 16 18 21 14 26 14 C 28 14 30 16 30 16 C 30 16 32 14 34 14 C 39 14 44 18 44 24 C 44 33 30 42 30 42 Z" fill="hsl(178 64% 50%)" />
      <animateTransform attributeName="transform" type="translate" values="70 160; 70 145; 70 160" dur="4s" repeatCount="indefinite" />
    </g>

    {/* Floating shield */}
    <g transform="translate(400 200)">
      <circle cx="30" cy="30" r="30" fill="white" filter="drop-shadow(0 10px 25px hsl(212 50% 30% / 0.18))" />
      <path d="M30 12 L44 18 V30 C44 38 30 48 30 48 C30 48 16 38 16 30 V18 Z" fill="url(#g1)" />
      <path d="M24 30 L28 34 L37 25" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <animateTransform attributeName="transform" type="translate" values="400 200; 400 215; 400 200" dur="5s" repeatCount="indefinite" />
    </g>

    {/* Floating stethoscope */}
    <g transform="translate(80 340)">
      <circle cx="28" cy="28" r="28" fill="white" filter="drop-shadow(0 10px 25px hsl(178 60% 35% / 0.2))" />
      <path d="M18 18 V26 C18 32 22 36 28 36 C34 36 38 32 38 26 V18" stroke="hsl(212 65% 35%)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="18" cy="18" r="2" fill="hsl(212 65% 35%)" />
      <circle cx="38" cy="18" r="2" fill="hsl(212 65% 35%)" />
      <circle cx="28" cy="42" r="4" fill="hsl(178 64% 50%)" />
      <animateTransform attributeName="transform" type="translate" values="80 340; 80 325; 80 340" dur="4.5s" repeatCount="indefinite" />
    </g>
  </svg>
);
