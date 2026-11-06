import {
  Activity,
  Clock3,
  CloudSun,
  Command,
  History,
  Palette,
  PlugZap,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import type {
  ActionId,
  Emotion,
} from "../domain/companionEngine";
import {
  CHARACTERS,
  SCENES,
  canCharacterUseAction,
} from "../domain/characterConfig";
import type {
  CharacterId,
  SceneId,
} from "../domain/companionState";
import type {
  AppearanceSettings,
  InteractionEvent,
  LightingPreset,
} from "../store/useCompanionStore";
import type { EnvironmentMode } from "../domain/environment";

interface DebugConsoleProps {
  emotion: Emotion;
  action: ActionId;
  lighting: LightingPreset;
  sceneId: SceneId;
  characterId: CharacterId;
  revision: number;
  events: InteractionEvent[];
  appearance: AppearanceSettings;
  aiStatus: "LOCAL" | "CONNECTING" | "AI" | "FALLBACK";
  aiEnabled: boolean;
  voiceOutputEnabled: boolean;
  voiceOutputSupported: boolean;
  isOpen: boolean;
  systemInstruction: string;
  environmentMode: EnvironmentMode;
  environmentStatus: string;
  environmentLoading: boolean;
  onClose: () => void;
  onForceEmotion: (emotion: Emotion) => void;
  onForceAction: (action: ActionId) => void;
  onSetLighting: (lighting: LightingPreset) => void;
  onSetScene: (sceneId: SceneId) => void;
  onSetCharacter: (characterId: CharacterId) => void;
  onShowNotice: (message: string) => void;
  onSetSystemInstruction: (instruction: string) => void;
  onToggleTimeEnvironment: () => void;
  onToggleWeatherEnvironment: () => void;
  onClearEvents: () => void;
  onUpdateAppearance: (patch: Partial<AppearanceSettings>) => void;
  onSetAiEnabled: (enabled: boolean) => void;
  onSetVoiceOutput: (enabled: boolean) => void;
}

type DebugTab = "status" | "appearance" | "integrations" | "history";

const emotions: Emotion[] = [
  "IDLE",
  "HAPPY",
  "SHY",
  "SAD",
  "SLEEPY",
  "ANGRY",
];

const actions: Array<{ id: ActionId; label: string }> = [
  { id: "IDLE", label: "待机" },
  { id: "JUMP", label: "跳跃" },
  { id: "DANCE", label: "欢呼" },
  { id: "WAVE", label: "挥手" },
  { id: "PUNCH", label: "挥拳" },
  { id: "SIT", label: "坐下" },
];

const lightingOptions: Array<{ id: LightingPreset; label: string }> = [
  { id: "AUTO", label: "自动" },
  { id: "WARM", label: "暖橙" },
  { id: "NIGHT", label: "星夜" },
];

const sceneIds = Object.keys(SCENES) as SceneId[];
const characterIds = Object.keys(CHARACTERS) as CharacterId[];

const tabs: Array<{
  id: DebugTab;
  label: string;
  icon: typeof Activity;
}> = [
  { id: "status", label: "状态", icon: Activity },
  { id: "appearance", label: "外观", icon: Palette },
  { id: "integrations", label: "集成", icon: PlugZap },
  { id: "history", label: "历史", icon: History },
];

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(timestamp);
}

export function DebugConsole({
  emotion,
  action,
  lighting,
  sceneId,
  characterId,
  revision,
  events,
  appearance,
  aiStatus,
  aiEnabled,
  voiceOutputEnabled,
  voiceOutputSupported,
  isOpen,
  systemInstruction,
  environmentMode,
  environmentStatus,
  environmentLoading,
  onClose,
  onForceEmotion,
  onForceAction,
  onSetLighting,
  onSetScene,
  onSetCharacter,
  onShowNotice,
  onSetSystemInstruction,
  onToggleTimeEnvironment,
  onToggleWeatherEnvironment,
  onClearEvents,
  onUpdateAppearance,
  onSetAiEnabled,
  onSetVoiceOutput,
}: DebugConsoleProps) {
  const [tab, setTab] = useState<DebugTab>("status");
  const [notice, setNotice] = useState("");
  const [instruction, setInstruction] = useState(systemInstruction);
  const [imageError, setImageError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    setInstruction(systemInstruction);
  }, [isOpen, systemInstruction]);

  const handleNoticeSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!notice.trim()) {
      return;
    }
    onShowNotice(notice);
    setNotice("");
  };

  const handleInstructionSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSetSystemInstruction(instruction);
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith("image/")) {
      setImageError("请选择图片文件");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setImageError("图片不能超过 3 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (result) {
        onUpdateAppearance({ customImageDataUrl: result });
        setImageError(null);
      }
    };
    reader.onerror = () => setImageError("图片读取失败");
    reader.readAsDataURL(file);
  };

  return (
    <>
      <button
        className={`drawer-backdrop ${isOpen ? "is-open" : ""}`}
        type="button"
        aria-label="关闭调试面板遮罩"
        tabIndex={isOpen ? 0 : -1}
        onClick={onClose}
      />
      <aside
        className={`debug-panel ${isOpen ? "is-open" : ""}`}
        aria-label="开发者调试面板"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <header className="debug-header">
          <div className="debug-title-lockup">
            <span className="debug-orbit" aria-hidden="true">
              <Command size={18} />
            </span>
            <div>
              <h2>状态监控与远程调试</h2>
              <p>修订 {String(revision).padStart(3, "0")}</p>
            </div>
          </div>
          <button
            className="icon-button debug-close"
            type="button"
            aria-label="关闭调试面板"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </header>

        <div className="debug-tabs" role="tablist" aria-label="调试面板分区">
          {tabs.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? "is-active" : ""}
                onClick={() => setTab(item.id)}
              >
                <Icon size={15} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="debug-content">
          {tab === "status" ? (
            <div className="debug-tab-panel" role="tabpanel" aria-label="状态">
              <section className="debug-section state-summary">
                <div className="state-code-block">
                  <span className="section-label">当前情绪</span>
                  <strong aria-label="当前情绪状态码">{emotion}</strong>
                </div>
                <div className="state-metrics">
                  <span>
                    <small>动作</small>
                    <strong data-testid="current-action">{action}</strong>
                  </span>
                  <span>
                    <small>场景</small>
                    <strong data-testid="current-scene">{sceneId}</strong>
                  </span>
                  <span>
                    <small>角色</small>
                    <strong data-testid="current-character">
                      {CHARACTERS[characterId].label}
                    </strong>
                  </span>
                  <span>
                    <small>AI</small>
                    <strong data-testid="ai-status">{aiStatus}</strong>
                  </span>
                </div>
              </section>

              <section className="debug-section">
                <div className="section-heading">
                  <h3>情绪调试</h3>
                  <span>直接注入</span>
                </div>
                <div className="debug-button-grid">
                  {emotions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={item === emotion ? "is-active" : ""}
                      aria-label={`强制 ${item}`}
                      onClick={() => onForceEmotion(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>

              <section className="debug-section">
                <div className="section-heading">
                  <h3>动作调试</h3>
                  <span>{CHARACTERS[characterId].label}</span>
                </div>
                <div className="debug-button-grid">
                  {actions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={item.id === action ? "is-active" : ""}
                      disabled={!canCharacterUseAction(characterId, item.id)}
                      aria-label={`强制动作 ${item.label}`}
                      onClick={() => onForceAction(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="debug-section">
                <div className="section-heading">
                  <h3>角色与场景</h3>
                  <span>相互独立</span>
                </div>
                <div className="scene-choice-grid" aria-label="角色选择">
                  {characterIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={characterId === id ? "is-active" : ""}
                      onClick={() => onSetCharacter(id)}
                    >
                      {CHARACTERS[id].label}
                    </button>
                  ))}
                </div>
                <div
                  className="scene-choice-grid scene-choice-grid--four"
                  aria-label="场景选择"
                >
                  {sceneIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      className={sceneId === id ? "is-active" : ""}
                      onClick={() => onSetScene(id)}
                    >
                      {SCENES[id].label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="debug-section">
                <div className="section-heading">
                  <h3>灯光场景</h3>
                  <span>{lighting}</span>
                </div>
                <div className="segmented-control" aria-label="灯光场景">
                  {lightingOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      className={lighting === option.id ? "is-active" : ""}
                      onClick={() => onSetLighting(option.id)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {tab === "appearance" ? (
            <div className="debug-tab-panel" role="tabpanel" aria-label="外观">
              <section className="debug-section appearance-section">
                <div className="section-heading">
                  <h3>角色外观</h3>
                  <span>{appearance.displayName}</span>
                </div>
                <div className="appearance-grid">
                  <label>
                    <span>名称</span>
                    <input
                      value={appearance.displayName}
                      maxLength={20}
                      onChange={(event) =>
                        onUpdateAppearance({
                          displayName: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    <span>主色</span>
                    <input
                      type="color"
                      value={appearance.accentColor}
                      onChange={(event) =>
                        onUpdateAppearance({
                          accentColor: event.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <label className="bio-field">
                  <span>简介</span>
                  <textarea
                    value={appearance.bio}
                    maxLength={120}
                    onChange={(event) =>
                      onUpdateAppearance({ bio: event.target.value })
                    }
                  />
                </label>

                <div className="upload-row">
                  <label className="upload-button">
                    <Upload size={15} />
                    <span>上传图片</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </label>
                  {appearance.customImageDataUrl ? (
                    <div className="image-preview">
                      <img
                        src={appearance.customImageDataUrl}
                        alt="自定义角色预览"
                        style={{
                          transform: `scale(${appearance.imageZoom})`,
                        }}
                      />
                    </div>
                  ) : (
                    <span className="image-help">PNG / JPG，最大 3 MB</span>
                  )}
                </div>
                <label className="zoom-field">
                  <span>裁切缩放</span>
                  <input
                    type="range"
                    min="1"
                    max="1.8"
                    step="0.05"
                    value={appearance.imageZoom}
                    onChange={(event) =>
                      onUpdateAppearance({
                        imageZoom: Number(event.target.value),
                      })
                    }
                  />
                </label>
                {imageError ? (
                  <p className="field-error">{imageError}</p>
                ) : null}
              </section>
            </div>
          ) : null}

          {tab === "integrations" ? (
            <div className="debug-tab-panel" role="tabpanel" aria-label="集成">
              <section className="debug-section">
                <div className="section-heading">
                  <h3>环境联动</h3>
                  <span>{environmentMode}</span>
                </div>
                <div className="integration-toggles">
                  <button
                    type="button"
                    className={environmentMode === "TIME" ? "is-active" : ""}
                    aria-pressed={environmentMode === "TIME"}
                    onClick={onToggleTimeEnvironment}
                  >
                    <Clock3 size={14} />
                    跟随时间
                  </button>
                  <button
                    type="button"
                    className={
                      environmentMode === "WEATHER" ? "is-active" : ""
                    }
                    aria-pressed={environmentMode === "WEATHER"}
                    disabled={environmentLoading}
                    onClick={onToggleWeatherEnvironment}
                  >
                    <CloudSun size={14} />
                    实时天气
                  </button>
                </div>
                <p className="debug-help environment-status" aria-live="polite">
                  {environmentStatus ||
                    (environmentMode === "MANUAL"
                      ? "本地场景固定为晴朗白天"
                      : "环境已跟随真实世界")}
                </p>
              </section>

              <section className="debug-section">
                <div className="section-heading">
                  <h3>模型与语音</h3>
                  <span>{aiStatus}</span>
                </div>
                <div className="integration-toggles">
                  <button
                    type="button"
                    className={aiEnabled ? "is-active" : ""}
                    aria-pressed={aiEnabled}
                    onClick={() => onSetAiEnabled(!aiEnabled)}
                  >
                    AI 语义
                  </button>
                  <button
                    type="button"
                    className={voiceOutputEnabled ? "is-active" : ""}
                    aria-pressed={voiceOutputEnabled}
                    disabled={!voiceOutputSupported}
                    onClick={() => onSetVoiceOutput(!voiceOutputEnabled)}
                  >
                    语音播报
                  </button>
                </div>
              </section>

              <section className="debug-section">
                <div className="section-heading">
                  <h3>角色行为指令</h3>
                  <span>服务端</span>
                </div>
                <p className="debug-help">
                  仅影响后续 AI 语义分析和回复措辞。
                </p>
                <form
                  className="instruction-form"
                  onSubmit={handleInstructionSubmit}
                >
                  <textarea
                    aria-label="角色行为指令"
                    value={instruction}
                    maxLength={500}
                    placeholder="例如：回答简短，像在夜晚轻声说话。"
                    onChange={(event) => setInstruction(event.target.value)}
                  />
                  <button type="submit" aria-label="应用角色指令">
                    <Send size={15} />
                    <span>应用指令</span>
                  </button>
                </form>
              </section>

              <section className="debug-section">
                <div className="section-heading">
                  <h3>气泡预览</h3>
                  <span>本地显示</span>
                </div>
                <form className="notice-form" onSubmit={handleNoticeSubmit}>
                  <input
                    value={notice}
                    onChange={(event) => setNotice(event.target.value)}
                    placeholder="输入临时预览文字"
                    aria-label="系统提示内容"
                  />
                  <button type="submit" aria-label="发送系统提示">
                    <Send size={16} />
                  </button>
                </form>
              </section>
            </div>
          ) : null}

          {tab === "history" ? (
            <div
              className="debug-tab-panel debug-tab-panel--history"
              role="tabpanel"
              aria-label="历史"
            >
              <section className="debug-section event-section">
                <div className="section-heading">
                  <h3>互动历史</h3>
                  <div className="event-actions">
                    <span>{events.length} 条</span>
                    {events.length > 0 ? (
                      confirmClear ? (
                        <>
                          <button
                            type="button"
                            className="text-action"
                            onClick={() => {
                              onClearEvents();
                              setConfirmClear(false);
                            }}
                          >
                            确认
                          </button>
                          <button
                            type="button"
                            className="text-action"
                            onClick={() => setConfirmClear(false)}
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="icon-action"
                          aria-label="清空互动历史"
                          onClick={() => setConfirmClear(true)}
                        >
                          <Trash2 size={13} />
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
                <div
                  className="event-list"
                  role="log"
                  aria-label="互动历史日志"
                >
                  {events.length === 0 ? (
                    <p className="empty-log">等待第一次互动</p>
                  ) : (
                    events.map((event) => (
                      <article className="event-row" key={event.id}>
                        <div className="event-row-top">
                          <span className="event-source">
                            {event.label}
                          </span>
                          <time
                            dateTime={new Date(
                              event.timestamp,
                            ).toISOString()}
                          >
                            {formatTime(event.timestamp)}
                          </time>
                        </div>
                        <p>{event.detail}</p>
                        <div className="event-meta">
                          <span>{event.type}</span>
                          {event.previousEmotion || event.nextEmotion ? (
                            <span>
                              {event.previousEmotion ?? "—"} {"->"}{" "}
                              {event.nextEmotion ?? "—"}
                            </span>
                          ) : null}
                          {event.previousAction || event.nextAction ? (
                            <span>
                              {event.previousAction ?? "—"} {"->"}{" "}
                              {event.nextAction ?? "—"}
                            </span>
                          ) : null}
                          {event.provider ? (
                            <span>{event.provider}</span>
                          ) : null}
                          {event.durationMs !== undefined ? (
                            <span>{event.durationMs} ms</span>
                          ) : null}
                          <span>{event.status}</span>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
