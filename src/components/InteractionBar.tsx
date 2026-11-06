import {
  Hand,
  Mic,
  MicOff,
  MoonStar,
  Send,
  Sparkles,
} from "lucide-react";
import type { FormEvent } from "react";
import {
  quickActions,
  type EmotionResult,
} from "../domain/companionEngine";

interface InteractionBarProps {
  companionName: string;
  value: string;
  isThinking: boolean;
  voiceSupported: boolean;
  voiceListening: boolean;
  voiceError: string | null;
  onChange: (value: string) => void;
  onDraftActivity: (active: boolean) => void;
  onSubmit: (text: string) => void | Promise<void>;
  onQuickAction: (result: EmotionResult, label: string) => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
}

const quickIcons = {
  touch: Hand,
  praise: Sparkles,
  sleep: MoonStar,
};

export function InteractionBar({
  companionName,
  value,
  isThinking,
  voiceSupported,
  voiceListening,
  voiceError,
  onChange,
  onDraftActivity,
  onSubmit,
  onQuickAction,
  onStartVoice,
  onStopVoice,
}: InteractionBarProps) {
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim()) {
      return;
    }
    onDraftActivity(false);
    await onSubmit(value);
  };

  return (
    <div className="interaction-bar">
      <form
        className="message-form"
        data-has-value={value.length > 0}
        onSubmit={handleSubmit}
      >
        <label className="sr-only" htmlFor="companion-message">
          和{companionName}说点什么
        </label>
        <input
          id="companion-message"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => onDraftActivity(true)}
          onBlur={() => onDraftActivity(false)}
          placeholder={`和${companionName}说点什么`}
          autoComplete="off"
        />
        <button
          className={`voice-input-button ${voiceListening ? "is-active" : ""}`}
          type="button"
          aria-label={
            voiceSupported
              ? voiceListening
                ? "停止语音输入"
                : "开始语音输入"
              : "语音输入不可用"
          }
          aria-pressed={voiceListening}
          disabled={!voiceSupported}
          title={
            voiceSupported
              ? "语音输入，识别后可继续编辑"
              : "当前浏览器不支持语音输入"
          }
          onClick={voiceListening ? onStopVoice : onStartVoice}
        >
          {voiceSupported ? <Mic size={18} /> : <MicOff size={18} />}
        </button>
        <button
          className="send-button"
          type="submit"
          aria-label="发送文字"
          disabled={!value.trim() || isThinking}
        >
          {isThinking ? (
            <span className="sending-dot" aria-hidden="true" />
          ) : (
            <Send size={19} />
          )}
        </button>
      </form>

      <div className="quick-actions" aria-label="快捷互动">
        {quickActions.map((action) => {
          const Icon = quickIcons[action.icon];
          return (
            <button
              key={action.id}
              type="button"
              className="quick-button"
              aria-label={action.label}
              onClick={() => onQuickAction(action, action.label)}
            >
              <Icon size={17} />
              <span>{action.label}</span>
            </button>
          );
        })}
      </div>
      {voiceListening || voiceError ? (
        <p className="voice-status" role="status" aria-live="polite">
          {voiceListening ? "正在聆听，说完后可继续编辑" : voiceError}
        </p>
      ) : null}
    </div>
  );
}
