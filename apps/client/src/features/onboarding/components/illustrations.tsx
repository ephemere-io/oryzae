export function ConceptIllo() {
  return (
    <svg viewBox="0 0 280 200" className="ob-illo" aria-hidden="true">
      <defs>
        <radialGradient id="ob-glow-c" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#8EA89C" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#8EA89C" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="140" cy="100" r="92" fill="url(#ob-glow-c)" />
      <ellipse
        cx="140"
        cy="100"
        rx="78"
        ry="78"
        fill="none"
        stroke="#7A7440"
        strokeOpacity="0.18"
        strokeWidth="1"
        strokeDasharray="2 6"
      />
      <circle cx="140" cy="100" r="8" fill="#8EA89C" />
      <circle
        cx="140"
        cy="100"
        r="14"
        fill="none"
        stroke="#8EA89C"
        strokeOpacity="0.4"
        strokeWidth="1"
      />
      <circle cx="62" cy="100" r="4" fill="#9C9658" opacity="0.85" />
      <circle cx="218" cy="100" r="3" fill="#9C9658" opacity="0.7" />
      <circle cx="140" cy="22" r="3.5" fill="#D4714E" opacity="0.7" />
      <circle cx="140" cy="178" r="3" fill="#9C9658" opacity="0.6" />
      <circle cx="86" cy="44" r="2.5" fill="#9C9658" opacity="0.5" />
      <circle cx="194" cy="156" r="2.5" fill="#9C9658" opacity="0.5" />
    </svg>
  );
}

export function QuestionIllo() {
  return (
    <svg viewBox="0 0 280 200" className="ob-illo" aria-hidden="true">
      <line
        x1="40"
        y1="100"
        x2="240"
        y2="100"
        stroke="#7A7440"
        strokeOpacity="0.25"
        strokeWidth="1"
        strokeDasharray="3 5"
      />
      <circle cx="140" cy="100" r="10" fill="#8EA89C" />
      <circle
        cx="140"
        cy="100"
        r="22"
        fill="none"
        stroke="#8EA89C"
        strokeOpacity="0.3"
        strokeWidth="1.5"
      />
      <circle
        cx="140"
        cy="100"
        r="34"
        fill="none"
        stroke="#8EA89C"
        strokeOpacity="0.15"
        strokeWidth="1"
      />
      <path d="M 140 78 L 140 60" stroke="#8EA89C" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M 130 64 L 140 54 L 150 64"
        fill="none"
        stroke="#8EA89C"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EditorIllo() {
  return (
    <svg viewBox="0 0 280 200" className="ob-illo" aria-hidden="true">
      <rect
        x="56"
        y="44"
        width="168"
        height="120"
        rx="8"
        fill="#FDFBF7"
        stroke="#7A7440"
        strokeOpacity="0.2"
        strokeWidth="1"
      />
      <rect x="72" y="62" width="100" height="3" rx="1.5" fill="#8EA89C" opacity="0.7" />
      <rect x="72" y="78" width="136" height="2" rx="1" fill="#7A7440" opacity="0.35" />
      <rect x="72" y="88" width="120" height="2" rx="1" fill="#7A7440" opacity="0.35" />
      <rect x="72" y="98" width="128" height="2" rx="1" fill="#7A7440" opacity="0.35" />
      <rect x="72" y="108" width="92" height="2" rx="1" fill="#7A7440" opacity="0.35" />
      <rect
        x="72"
        y="128"
        width="88"
        height="14"
        rx="3"
        fill="#FFFBE0"
        stroke="#9C9658"
        strokeOpacity="0.4"
        strokeWidth="1"
      />
      <rect x="80" y="134" width="72" height="2" rx="1" fill="#7A7440" opacity="0.55" />
      <rect x="172" y="60" width="1.5" height="14" fill="#8EA89C">
        <animate attributeName="opacity" values="1;0;1" dur="1.1s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

export function JarIllo() {
  return (
    <svg viewBox="0 0 280 200" className="ob-illo" aria-hidden="true">
      <g transform="translate(85,12) scale(0.55)">
        <path
          d="M 86 36 L 86 78 C 86 88, 50 100, 42 138 C 36 172, 64 196, 100 196 C 136 196, 164 172, 158 138 C 150 100, 114 88, 114 78 L 114 36 Z"
          fill="#F2EDE0"
          stroke="#7A7440"
          strokeWidth="3.5"
        />
        <ellipse cx="100" cy="36" rx="14" ry="3.5" fill="none" stroke="#7A7440" strokeWidth="3.5" />
        <g fill="#9C9658">
          <circle cx="100" cy="96" r="9.5" />
          <circle cx="100" cy="118" r="7.5" />
          <circle cx="100" cy="138" r="5.5" />
          <circle cx="78" cy="108" r="7.5" />
          <circle cx="78" cy="128" r="6" />
          <circle cx="122" cy="108" r="7.5" />
          <circle cx="122" cy="128" r="6" />
        </g>
      </g>
      <circle cx="222" cy="60" r="3" fill="#8EA89C" opacity="0.5">
        <animate attributeName="cy" values="80;40" dur="3s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.6;0" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx="232" cy="80" r="2" fill="#8EA89C" opacity="0.4">
        <animate attributeName="cy" values="100;55" dur="3.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0.5;0" dur="3.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}
