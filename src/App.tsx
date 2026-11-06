import {
  Trees,
  TreePine,
  Waves,
  Orbit,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  loadPreferences,
  savePreferences,
} from "./api/client";
import { CompanionPrototype } from "./components/CompanionPrototype";
import { ConversationStream } from "./components/ConversationStream";
import { DebugConsole } from "./components/DebugConsole";
import { InteractionBar } from "./components/InteractionBar";
import { TopBar } from "./components/TopBar";
import { CHARACTERS, SCENES } from "./domain/characterConfig";
import { ACTION_DURATION_MS } from "./domain/companionState";
import type { SceneId } from "./domain/companionState";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import { useWorldEnvironment } from "./hooks/useWorldEnvironment";
import { useCompanionStore } from "./store/useCompanionStore";

const sceneIcons = {
  BEACH: Waves,
  MEADOW: Trees,
  FOREST: TreePine,
  SPACE: Orbit,
};

export default function App() {
  const [debugOpen, setDebugOpen] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftActive, setDraftActive] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const localImageLoaded = useRef(false);
  const emotion = useCompanionStore((state) => state.emotion);
  const action = useCompanionStore((state) => state.action);
  const actionNonce = useCompanionStore((state) => state.actionNonce);
  const reply = useCompanionStore((state) => state.reply);
  const messages = useCompanionStore((state) => state.messages);
  const systemNotice = useCompanionStore((state) => state.systemNotice);
  const systemInstruction = useCompanionStore(
    (state) => state.systemInstruction,
  );
  const lighting = useCompanionStore((state) => state.lighting);
  const sceneId = useCompanionStore((state) => state.sceneId);
  const characterId = useCompanionStore((state) => state.characterId);
  const appearance = useCompanionStore((state) => state.appearance);
  const revision = useCompanionStore((state) => state.revision);
  const aiStatus = useCompanionStore((state) => state.aiStatus);
  const aiEnabled = useCompanionStore((state) => state.aiEnabled);
  const isThinking = useCompanionStore((state) => state.isThinking);
  const voiceOutputEnabled = useCompanionStore(
    (state) => state.voiceOutputEnabled,
  );
  const events = useCompanionStore((state) => state.events);
  const submitText = useCompanionStore((state) => state.submitText);
  const runQuickAction = useCompanionStore((state) => state.runQuickAction);
  const forceEmotion = useCompanionStore((state) => state.forceEmotion);
  const forceAction = useCompanionStore((state) => state.forceAction);
  const settleAction = useCompanionStore((state) => state.settleAction);
  const setLighting = useCompanionStore((state) => state.setLighting);
  const setScene = useCompanionStore((state) => state.setScene);
  const setCharacter = useCompanionStore((state) => state.setCharacter);
  const showSystemNotice = useCompanionStore(
    (state) => state.showSystemNotice,
  );
  const setSystemInstruction = useCompanionStore(
    (state) => state.setSystemInstruction,
  );
  const clearEvents = useCompanionStore((state) => state.clearEvents);
  const updateAppearance = useCompanionStore(
    (state) => state.updateAppearance,
  );
  const setAiEnabled = useCompanionStore((state) => state.setAiEnabled);
  const setVoiceOutputEnabled = useCompanionStore(
    (state) => state.setVoiceOutputEnabled,
  );
  const hydratePreferences = useCompanionStore(
    (state) => state.hydratePreferences,
  );
  const speech = useSpeechSynthesis();
  const environment = useWorldEnvironment();
  const handleVoiceError = useCallback((message: string) => {
    setVoiceError(message);
  }, []);
  const voice = useSpeechRecognition({
    onResult: setDraftText,
    onError: handleVoiceError,
    companionName: appearance.displayName,
  });
  const startVoice = voice.start;
  const wakeDetected = voice.wakeDetected;
  const lastSpokenReply = useRef(reply);
  const handledWake = useRef(0);
  const dayPhaseLabel = {
    DAWN: "清晨",
    DAY: "白天",
    DUSK: "黄昏",
    NIGHT: "夜晚",
  }[environment.dayPhase];
  const environmentLabel =
    environment.mode === "WEATHER"
      ? `${environment.weather.label}${
          environment.weather.temperatureC === null
            ? ""
            : ` ${environment.weather.temperatureC}°C`
        }`
      : environment.mode === "TIME"
        ? `系统时间 · ${dayPhaseLabel}`
        : "本地陪伴";

  const engagement = isThinking
    ? "THINKING"
    : draftActive || voice.listening
      ? "LISTENING"
      : "IDLE";
  const bubbleText =
    systemNotice ??
    (engagement === "THINKING"
      ? "让我想一想。"
      : engagement === "LISTENING"
        ? "我在听，你慢慢说。"
        : reply);
  const bubbleNonce = messages.filter(
    (message) => message.role !== "USER",
  ).length;

  useEffect(() => {
    if (voiceOutputEnabled && reply !== lastSpokenReply.current) {
      speech.speak(reply);
    }
    lastSpokenReply.current = reply;
  }, [reply, speech, voiceOutputEnabled]);

  useEffect(() => {
    if (action === "IDLE" || ACTION_DURATION_MS[action] === 0) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      settleAction(actionNonce);
    }, ACTION_DURATION_MS[action]);
    return () => window.clearTimeout(timer);
  }, [action, actionNonce, settleAction]);

  useEffect(() => {
    if (wakeDetected <= handledWake.current) {
      return;
    }
    handledWake.current = wakeDetected;
    setVoiceError(null);
    const input = document.getElementById(
      "companion-message",
    ) as HTMLInputElement | null;
    input?.focus();
    startVoice();
  }, [startVoice, wakeDetected]);

  useEffect(() => {
    let cancelled = false;
    loadPreferences()
      .then((preferences) => {
        if (
          !cancelled &&
          preferences &&
          preferences.sceneId in SCENES &&
          preferences.characterId in CHARACTERS
        ) {
          hydratePreferences({
            ...preferences,
            sceneId: preferences.sceneId as keyof typeof SCENES,
            characterId:
              preferences.characterId as keyof typeof CHARACTERS,
          });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setPreferencesReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hydratePreferences]);

  useEffect(() => {
    if (!preferencesReady) {
      return undefined;
    }
    const timer = window.setTimeout(() => {
      void savePreferences({
        displayName: appearance.displayName,
        accentColor: appearance.accentColor,
        bio: appearance.bio,
        sceneId,
        characterId,
      }).catch(() => undefined);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    appearance.accentColor,
    appearance.bio,
    appearance.displayName,
    characterId,
    preferencesReady,
    sceneId,
  ]);

  useEffect(() => {
    try {
      const image = localStorage.getItem("aolinu-custom-image");
      const zoom = Number(localStorage.getItem("aolinu-image-zoom") ?? "1");
      if (image) {
        updateAppearance({
          customImageDataUrl: image,
          imageZoom: Number.isFinite(zoom) ? zoom : 1,
        });
      }
    } catch {
      // Local storage can be unavailable in privacy-restricted contexts.
    } finally {
      localImageLoaded.current = true;
    }
  }, [updateAppearance]);

  useEffect(() => {
    if (!localImageLoaded.current) {
      return;
    }
    try {
      if (appearance.customImageDataUrl) {
        localStorage.setItem(
          "aolinu-custom-image",
          appearance.customImageDataUrl,
        );
      } else {
        localStorage.removeItem("aolinu-custom-image");
      }
      localStorage.setItem(
        "aolinu-image-zoom",
        String(appearance.imageZoom),
      );
    } catch {
      // The image remains usable for the current session.
    }
  }, [appearance.customImageDataUrl, appearance.imageZoom]);

  useEffect(() => {
    if (!debugOpen) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDebugOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [debugOpen]);

  const handleSubmit = async (text: string) => {
    setVoiceError(null);
    await submitText(text);
    setDraftText("");
  };

  const handleWakeToggle = () => {
    setVoiceError(null);
    if (voice.wakeListening) {
      voice.stopWakeListening();
    } else {
      voice.startWakeListening();
    }
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#companion-message">
        跳到对话输入
      </a>
      <TopBar
        companionName={appearance.displayName}
        wakeListening={voice.wakeListening}
        voiceSupported={voice.supported}
        environmentLabel={environmentLabel}
        onToggleWake={handleWakeToggle}
        onOpenDebug={() => setDebugOpen(true)}
      />

      <main className="workspace">
        <div className="habitat-shell">
          <CompanionPrototype
            emotion={emotion}
            action={action}
            actionNonce={actionNonce}
            reply={bubbleText}
            bubbleNonce={bubbleNonce}
            lighting={lighting}
            sceneId={sceneId}
            characterId={characterId}
            displayName={appearance.displayName}
            accentColor={appearance.accentColor}
            customImageDataUrl={appearance.customImageDataUrl}
            imageZoom={appearance.imageZoom}
            engagement={engagement}
            dayPhase={environment.dayPhase}
            weather={environment.weather}
          />

          <ConversationStream
            messages={messages.slice(-8)}
            isThinking={isThinking}
            companionName={appearance.displayName}
          />

          <nav className="scene-rail" aria-label="场景选择">
            {(Object.keys(SCENES) as SceneId[]).map((id) => {
              const Icon = sceneIcons[id];
              return (
                <button
                  key={id}
                  type="button"
                  className={sceneId === id ? "is-active" : ""}
                  aria-pressed={sceneId === id}
                  aria-label={SCENES[id].label}
                  title={SCENES[id].label}
                  onClick={() => setScene(id)}
                >
                  <Icon size={15} />
                  <span>{SCENES[id].label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <InteractionBar
          companionName={appearance.displayName}
          value={draftText}
          isThinking={isThinking}
          voiceSupported={voice.supported}
          voiceListening={voice.listening}
          voiceError={voiceError}
          onChange={(value) => {
            setDraftText(value);
            setDraftActive(Boolean(value));
          }}
          onDraftActivity={setDraftActive}
          onSubmit={handleSubmit}
          onQuickAction={runQuickAction}
          onStartVoice={() => {
            setVoiceError(null);
            voice.start();
          }}
          onStopVoice={voice.stop}
        />
      </main>

      <DebugConsole
        emotion={emotion}
        action={action}
        lighting={lighting}
        sceneId={sceneId}
        characterId={characterId}
        revision={revision}
        events={events}
        appearance={appearance}
        aiStatus={aiStatus}
        aiEnabled={aiEnabled}
        voiceOutputEnabled={voiceOutputEnabled}
        voiceOutputSupported={speech.supported}
        isOpen={debugOpen}
        systemInstruction={systemInstruction}
        environmentMode={environment.mode}
        environmentStatus={environment.status}
        environmentLoading={environment.loading}
        onClose={() => setDebugOpen(false)}
        onForceEmotion={forceEmotion}
        onForceAction={forceAction}
        onSetLighting={setLighting}
        onSetScene={setScene}
        onSetCharacter={setCharacter}
        onShowNotice={showSystemNotice}
        onSetSystemInstruction={setSystemInstruction}
        onToggleTimeEnvironment={environment.enableTime}
        onToggleWeatherEnvironment={environment.enableWeather}
        onClearEvents={clearEvents}
        onUpdateAppearance={updateAppearance}
        onSetAiEnabled={setAiEnabled}
        onSetVoiceOutput={setVoiceOutputEnabled}
      />
    </div>
  );
}
