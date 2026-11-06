import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  RotateCcw,
  Undo2,
  Redo2,
} from "lucide-react";
import type { ActionId, Emotion } from "../domain/companionEngine";
import { normalizePointer, type GazePoint } from "../domain/gaze";
import { isKayKitCharacter } from "../assets/kayKitCompanion";
import {
  CHARACTERS,
  SCENES,
} from "../domain/characterConfig";
import type {
  CharacterId,
  SceneId,
} from "../domain/companionState";
import type {
  DayPhase,
  WeatherSnapshot,
} from "../domain/environment";
import { clearWeather } from "../domain/environment";
import type { LightingPreset } from "../store/useCompanionStore";
import { CustomCompanion } from "./CustomCompanion";
import { ModelErrorBoundary } from "./ModelErrorBoundary";
import { SceneHabitat, WeatherLayer } from "./SceneHabitat";
import { SvgCompanion } from "./SvgCompanion";

const Companion3D = lazy(() =>
  import("./Companion3D").then((module) => ({
    default: module.Companion3D,
  })),
);

const KayKitCompanion3D = lazy(() =>
  import("./KayKitCompanion3D").then((module) => ({
    default: module.KayKitCompanion3D,
  })),
);

interface CompanionPrototypeProps {
  emotion: Emotion;
  action: ActionId;
  actionNonce?: number;
  reply: string;
  bubbleNonce?: number;
  lighting: LightingPreset;
  sceneId: SceneId;
  characterId: CharacterId;
  displayName: string;
  accentColor: string;
  customImageDataUrl: string | null;
  imageZoom: number;
  engagement?: "IDLE" | "LISTENING" | "THINKING";
  dayPhase?: DayPhase;
  weather?: WeatherSnapshot;
}

type ModelMode = "loading" | "ready" | "fallback" | "custom";
type ViewCommand = {
  direction: "left" | "right" | "reset";
  nonce: number;
};

type GazeStyle = CSSProperties & {
  "--gaze-x": string;
  "--gaze-y": string;
  "--eye-x": string;
  "--eye-y": string;
  "--head-x": string;
  "--head-y": string;
  "--head-rotate": string;
  "--companion-accent": string;
};

const neutralGazeStyle: GazeStyle = {
  "--gaze-x": "0",
  "--gaze-y": "0",
  "--eye-x": "0px",
  "--eye-y": "0px",
  "--head-x": "0px",
  "--head-y": "0px",
  "--head-rotate": "0deg",
  "--companion-accent": "#ef8c24",
};

const actionLabels: Record<ActionId, string> = {
  IDLE: "呼吸中",
  JUMP: "雀跃",
  DANCE: "欢呼",
  WAVE: "挥手",
  PUNCH: "鼓起勇气",
  SIT: "打瞌睡",
};

function supportsWebGL(): boolean {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !("WebGLRenderingContext" in window)
  ) {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
    );
  } catch {
    return false;
  }
}

function CompanionLoading({
  progress,
  name,
}: {
  progress: number;
  name: string;
}) {
  return (
    <div className="companion-loading" role="status" aria-live="polite">
      <div className="loading-figure" aria-hidden="true">
        <span className="loading-head" />
        <span className="loading-body" />
      </div>
      <span>正在唤醒 {name} · {Math.round(progress)}%</span>
    </div>
  );
}

export function CompanionPrototype({
  emotion,
  action,
  actionNonce = 0,
  reply,
  bubbleNonce = 0,
  lighting,
  sceneId,
  characterId,
  displayName,
  accentColor,
  customImageDataUrl,
  imageZoom,
  engagement = "IDLE",
  dayPhase,
  weather,
}: CompanionPrototypeProps) {
  const [webglAvailable] = useState(supportsWebGL);
  const [modelMode, setModelMode] = useState<ModelMode>(
    characterId === "CUSTOM_IMAGE" && customImageDataUrl
      ? "custom"
      : webglAvailable && characterId !== "CUSTOM_IMAGE"
        ? "loading"
        : "fallback",
  );
  const [modelProgress, setModelProgress] = useState(0);
  const [viewCommand, setViewCommand] = useState<ViewCommand>({
    direction: "reset",
    nonce: 0,
  });
  const [visibleBubble, setVisibleBubble] = useState("");
  const gazeRef = useRef<GazePoint>({ x: 0, y: 0 });
  const stageRef = useRef<HTMLElement>(null);
  const bubbleTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setModelProgress(0);
    if (characterId === "CUSTOM_IMAGE") {
      setModelMode(customImageDataUrl ? "custom" : "fallback");
      return;
    }
    setModelMode(webglAvailable ? "loading" : "fallback");
  }, [characterId, customImageDataUrl, webglAvailable]);

  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const headScale = reducedMotion ? 0.35 : 1;

  useEffect(() => {
    if (bubbleTimerRef.current !== null) {
      window.clearTimeout(bubbleTimerRef.current);
      bubbleTimerRef.current = null;
    }
    if (!reply) {
      setVisibleBubble("");
      return undefined;
    }
    setVisibleBubble(reply);
    bubbleTimerRef.current = window.setTimeout(() => {
      setVisibleBubble("");
      bubbleTimerRef.current = null;
    }, 4800);
    return () => {
      if (bubbleTimerRef.current !== null) {
        window.clearTimeout(bubbleTimerRef.current);
        bubbleTimerRef.current = null;
      }
    };
  }, [bubbleNonce, reply]);

  const handleModelReady = useCallback(() => {
    setModelProgress(100);
    setModelMode("ready");
  }, []);

  const handleModelError = useCallback(() => {
    setModelMode("fallback");
  }, []);

  const handleModelProgress = useCallback((value: number) => {
    setModelProgress(value);
  }, []);

  const applyGaze = useCallback(
    (target: HTMLElement, point: GazePoint) => {
      gazeRef.current = point;
      target.style.setProperty("--gaze-x", point.x.toFixed(2));
      target.style.setProperty("--gaze-y", point.y.toFixed(2));
      target.style.setProperty("--eye-x", `${(point.x * 7).toFixed(2)}px`);
      target.style.setProperty("--eye-y", `${(point.y * 5).toFixed(2)}px`);
      target.style.setProperty(
        "--head-x",
        `${(point.x * 10 * headScale).toFixed(2)}px`,
      );
      target.style.setProperty(
        "--head-y",
        `${(point.y * 7 * headScale).toFixed(2)}px`,
      );
      target.style.setProperty(
        "--head-rotate",
        `${(point.x * 2.2 * headScale).toFixed(2)}deg`,
      );
    },
    [headScale],
  );

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return undefined;
    }
    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const bounds = stage.getBoundingClientRect();
      applyGaze(
        stage,
        normalizePointer(event.clientX, event.clientY, bounds),
      );
    };
    const returnToCenter = () => {
      applyGaze(stage, { x: 0, y: 0 });
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        returnToCenter();
      }
    };
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    document.documentElement.addEventListener(
      "pointerleave",
      returnToCenter,
    );
    window.addEventListener("blur", returnToCenter);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener(
        "pointerleave",
        returnToCenter,
      );
      window.removeEventListener("blur", returnToCenter);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [applyGaze]);

  const modelLabel =
    modelMode === "custom"
      ? "图片"
      : modelMode === "fallback"
      ? "轻量模式"
      : modelMode === "loading"
        ? `3D ${Math.round(modelProgress)}%`
        : "3D";

  const issueViewCommand = (direction: ViewCommand["direction"]) => {
    setViewCommand((current) => ({
      direction,
      nonce: current.nonce + 1,
    }));
  };

  const stageStyle: GazeStyle = {
    ...neutralGazeStyle,
    "--companion-accent": accentColor,
  };

  return (
    <section
      ref={stageRef}
      className="companion-stage"
      data-testid="companion-stage"
      data-emotion={emotion}
      data-lighting={lighting}
      data-scene={sceneId}
      data-character={characterId}
      data-engagement={engagement}
      data-day-phase={dayPhase ?? "DAY"}
      data-weather={weather?.kind ?? "CLEAR"}
      data-render-mode={modelMode}
      data-reduced-motion={reducedMotion}
      style={stageStyle}
      aria-label={`${displayName}陪伴舞台`}
    >
      <SceneHabitat
        sceneId={sceneId}
        emotion={emotion}
        lighting={lighting}
        reducedMotion={reducedMotion}
        dayPhase={dayPhase}
        weather={weather}
      />

      {action === "SIT" ? (
        <div
          className="rest-cushion"
          data-testid="rest-cushion"
          aria-hidden="true"
        />
      ) : null}

      {emotion === "SLEEPY" ? (
        <div
          className="sleep-motes"
          data-testid="sleep-motes"
          aria-hidden="true"
        >
          <span>z</span>
          <span>z</span>
          <span>z</span>
        </div>
      ) : null}

      <div className="stage-status">
        <span className="live-status">
          <span className="live-dot" aria-hidden="true" />
          {engagement === "LISTENING"
            ? "聆听中"
            : engagement === "THINKING"
              ? "思考中"
              : "陪伴中"}
        </span>
        <span className="state-chip">{emotion}</span>
        <span className="action-chip">{actionLabels[action]}</span>
        <span className="model-chip">{modelLabel}</span>
      </div>

      <AnimatePresence initial={false}>
        {visibleBubble ? (
          <motion.div
            key="companion-speech"
            className="speech-bubble"
            data-testid="speech-bubble"
            role="status"
            aria-live="polite"
            initial={
              reducedMotion
                ? false
                : {
                    opacity: 0,
                    y: -6,
                    scale: 0.97,
                    x: "-50%",
                  }
            }
            animate={{ opacity: 1, y: 0, scale: 1, x: "-50%" }}
            exit={{
              opacity: 0,
              y: 4,
              scale: 0.985,
              x: "-50%",
            }}
            transition={{
              duration: reducedMotion ? 0 : 0.24,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            {visibleBubble}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {characterId === "CUSTOM_IMAGE" && customImageDataUrl ? (
        <CustomCompanion
          name={displayName}
          imageUrl={customImageDataUrl}
          zoom={imageZoom}
        />
      ) : webglAvailable && modelMode !== "fallback" ? (
        <div className="companion-3d-wrap">
          <ModelErrorBoundary fallback={null} onError={handleModelError}>
            <Suspense fallback={null}>
              {isKayKitCharacter(characterId) ? (
                <KayKitCompanion3D
                  key={characterId}
                  characterId={characterId}
                  action={action}
                  actionNonce={actionNonce}
                  emotion={emotion}
                  engagement={engagement}
                  lighting={lighting}
                  accentColor={accentColor}
                  gazeRef={gazeRef}
                  viewCommand={viewCommand}
                  onReady={handleModelReady}
                  onProgress={handleModelProgress}
                  onError={handleModelError}
                />
              ) : (
                <Companion3D
                  action={action}
                  emotion={emotion}
                  lighting={lighting}
                  characterId={characterId}
                  accentColor={accentColor}
                  gazeRef={gazeRef}
                  viewCommand={viewCommand}
                  onReady={handleModelReady}
                  onProgress={handleModelProgress}
                  onError={handleModelError}
                />
              )}
            </Suspense>
          </ModelErrorBoundary>
          {modelMode === "loading" ? (
            <CompanionLoading
              progress={modelProgress}
              name={displayName}
            />
          ) : null}
        </div>
      ) : (
        <>
          <div className="companion-shadow" aria-hidden="true" />
          <div className="companion-wrap">
            <SvgCompanion emotion={emotion} action={action} />
          </div>
        </>
      )}

      <WeatherLayer
        weather={weather ?? clearWeather}
        reducedMotion={reducedMotion}
      />

      {characterId !== "CUSTOM_IMAGE" ? (
        <div className="view-controls" aria-label="角色视角">
          <button
            type="button"
            aria-label="向左旋转角色"
            title="向左旋转"
            onClick={() => issueViewCommand("left")}
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            aria-label="重置角色视角"
            title="重置视角"
            onClick={() => issueViewCommand("reset")}
          >
            <RotateCcw size={16} />
          </button>
          <button
            type="button"
            aria-label="向右旋转角色"
            title="向右旋转"
            onClick={() => issueViewCommand("right")}
          >
            <Redo2 size={17} />
          </button>
        </div>
      ) : null}

      <div className="stage-caption">
        <span>{SCENES[sceneId].label}</span>
        <span className="caption-divider" aria-hidden="true" />
        <span>{actionLabels[action]}</span>
        <span className="caption-divider" aria-hidden="true" />
        <span>
          {modelMode === "custom"
            ? "图片形象"
            : modelMode === "fallback"
              ? "轻量渲染"
              : CHARACTERS[characterId].label}
        </span>
      </div>
    </section>
  );
}

