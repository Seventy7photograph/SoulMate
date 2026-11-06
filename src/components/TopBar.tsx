import {
  AudioLines,
  AudioLinesOff,
  Orbit,
  SlidersHorizontal,
} from "lucide-react";

interface TopBarProps {
  companionName: string;
  wakeListening: boolean;
  voiceSupported: boolean;
  environmentLabel: string;
  onToggleWake: () => void;
  onOpenDebug: () => void;
}

export function TopBar({
  companionName,
  wakeListening,
  voiceSupported,
  environmentLabel,
  onToggleWake,
  onOpenDebug,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <div className="brand-lockup" aria-label="AOLINU SoulMate">
        <span className="brand-mark" aria-hidden="true">
          <Orbit size={22} strokeWidth={1.8} />
        </span>
        <span className="brand-copy">
          <span className="brand-name">AOLINU</span>
          <span className="brand-product">
            SoulMate / {companionName}
          </span>
        </span>
      </div>

      <div className="top-bar-status" aria-live="polite">
        <span
          className={`wake-status ${wakeListening ? "is-listening" : ""}`}
        >
          <span className="live-dot" aria-hidden="true" />
          {wakeListening ? "正在等待唤醒" : environmentLabel}
        </span>
      </div>

      <div className="top-bar-actions">
        <button
          className={`wake-button ${wakeListening ? "is-active" : ""}`}
          type="button"
          aria-label={wakeListening ? "关闭语音唤醒" : "开启语音唤醒"}
          aria-pressed={wakeListening}
          disabled={!voiceSupported}
          onClick={onToggleWake}
          title={
            voiceSupported
              ? "语音唤醒"
              : "当前浏览器不支持语音唤醒"
          }
        >
          {voiceSupported ? (
            <AudioLines size={18} />
          ) : (
            <AudioLinesOff size={18} />
          )}
          <span className="wake-button-label">
            {wakeListening ? "聆听中" : "唤醒"}
          </span>
        </button>
        <button
          className="icon-button debug-toggle"
          type="button"
          aria-label="打开调试面板"
          title="调试面板"
          onClick={onOpenDebug}
        >
          <SlidersHorizontal size={18} />
        </button>
      </div>
    </header>
  );
}
