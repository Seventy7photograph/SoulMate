import type { ActionId, Emotion } from "../domain/companionEngine";

interface SvgCompanionProps {
  emotion: Emotion;
  action: ActionId;
}

function mouthPath(emotion: Emotion): string {
  switch (emotion) {
    case "HAPPY":
      return "M166 176 Q180 192 194 176";
    case "SHY":
      return "M169 180 Q180 186 191 180";
    case "SAD":
      return "M166 184 Q180 172 194 184";
    case "SLEEPY":
      return "M170 181 Q180 177 190 181";
    case "ANGRY":
      return "M166 184 Q180 174 194 184";
    default:
      return "M169 178 Q180 186 191 178";
  }
}

export function SvgCompanion({ emotion, action }: SvgCompanionProps) {
  return (
    <svg
      className="companion-svg"
      viewBox="0 0 360 500"
      role="img"
      aria-label={`轻量模式小雅，当前情绪 ${emotion}`}
      data-action={action}
    >
      <defs>
        <linearGradient id="shell-gradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffb55f" />
          <stop offset="54%" stopColor="#f19231" />
          <stop offset="100%" stopColor="#d9741e" />
        </linearGradient>
        <linearGradient id="face-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#25312e" />
          <stop offset="100%" stopColor="#121a18" />
        </linearGradient>
        <linearGradient id="core-gradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#9be3d2" />
          <stop offset="100%" stopColor="#5aa89a" />
        </linearGradient>
      </defs>

      <g className="companion-body-motion">
        <g className="companion-arm companion-arm-left">
          <rect x="72" y="286" width="54" height="30" rx="15" />
          <circle cx="72" cy="301" r="18" />
        </g>
        <g className="companion-arm companion-arm-right">
          <rect x="234" y="286" width="54" height="30" rx="15" />
          <circle cx="288" cy="301" r="18" />
        </g>

        <g className="companion-head-tracking">
          <path
            className="companion-ear"
            d="M105 91 Q99 45 126 66 L143 94 Z"
          />
          <path
            className="companion-ear"
            d="M255 91 Q261 45 234 66 L217 94 Z"
          />
          <path
            className="companion-antenna"
            d="M180 74 C175 51 166 43 151 36"
          />
          <circle className="antenna-tip" cx="149" cy="34" r="8" />

          <g className="companion-head">
            <rect
              className="companion-shell"
              x="91"
              y="74"
              width="178"
              height="138"
              rx="53"
            />
            <rect
              className="companion-face"
              x="112"
              y="105"
              width="136"
              height="84"
              rx="37"
            />

            <ellipse
              className="companion-eye"
              cx="151"
              cy="140"
              rx="18"
              ry="20"
            />
            <ellipse
              className="companion-eye"
              cx="209"
              cy="140"
              rx="18"
              ry="20"
            />

            <g className="companion-pupils">
              <circle className="pupil" cx="151" cy="141" r="8" />
              <circle className="pupil" cx="209" cy="141" r="8" />
              <circle className="eye-glint" cx="154" cy="137" r="2.6" />
              <circle className="eye-glint" cx="212" cy="137" r="2.6" />
            </g>

            {emotion === "SLEEPY" ? (
              <>
                <path className="eyelid" d="M132 139 Q151 130 170 139" />
                <path className="eyelid" d="M190 139 Q209 130 228 139" />
              </>
            ) : null}

            {emotion === "ANGRY" ? (
              <>
                <path className="eyebrow" d="M130 113 L169 121" />
                <path className="eyebrow" d="M230 113 L191 121" />
              </>
            ) : null}

            <path className="companion-mouth" d={mouthPath(emotion)} />
            {emotion === "SHY" ? (
              <>
                <ellipse
                  className="cheek"
                  cx="128"
                  cy="166"
                  rx="11"
                  ry="5"
                />
                <ellipse
                  className="cheek"
                  cx="232"
                  cy="166"
                  rx="11"
                  ry="5"
                />
              </>
            ) : null}
          </g>
        </g>

        <path
          className="companion-shell"
          d="M130 216 C122 242 104 298 110 333 C116 372 148 391 180 391 C212 391 244 372 250 333 C256 298 238 242 230 216 Z"
        />
        <ellipse
          className="companion-belly"
          cx="180"
          cy="306"
          rx="50"
          ry="56"
        />
        <circle className="companion-core" cx="180" cy="306" r="20" />
        <circle
          className="companion-core-ring"
          cx="180"
          cy="306"
          r="29"
        />

        <path
          className="companion-foot"
          d="M126 375 C120 399 121 422 146 429 C168 435 184 422 184 405 L184 383 Z"
        />
        <path
          className="companion-foot"
          d="M234 375 C240 399 239 422 214 429 C192 435 176 422 176 405 L176 383 Z"
        />
      </g>
    </svg>
  );
}

