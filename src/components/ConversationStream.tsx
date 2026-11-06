import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ConversationMessage } from "../domain/companionState";

interface ConversationStreamProps {
  messages: ConversationMessage[];
  isThinking: boolean;
  companionName: string;
}

function formatMessageTime(timestamp: number): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}

export function ConversationStream({
  messages,
  isThinking,
  companionName,
}: ConversationStreamProps) {
  const endRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const visibleMessages = expanded ? messages : messages.slice(-3);
  const hiddenCount = messages.length - visibleMessages.length;

  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === "function") {
      endRef.current.scrollIntoView({ block: "nearest" });
    }
  }, [expanded, isThinking, messages]);

  return (
    <section
      className={`conversation-stream ${
        expanded ? "is-expanded" : "is-collapsed"
      }`}
      data-expanded={expanded}
    >
      <header className="conversation-header">
        <span className="conversation-title">对话记录</span>
        <div className="conversation-header-actions">
          <span className="conversation-count" aria-hidden="true">
            {hiddenCount > 0 ? `+${hiddenCount}` : messages.length}
          </span>
          {messages.length > 3 ? (
            <button
              type="button"
              className="conversation-history-toggle"
              aria-label={
                expanded
                  ? "收起对话记录"
                  : `展开对话记录，还有${hiddenCount}条`
              }
              aria-expanded={expanded}
              title={expanded ? "收起" : "展开"}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? (
                <ChevronUp size={14} />
              ) : (
                <ChevronDown size={14} />
              )}
            </button>
          ) : null}
        </div>
      </header>
      <div
        className="conversation-log"
        role="log"
        aria-label="对话记录"
        aria-live="polite"
      >
        {visibleMessages.map((message) => (
          <article
            className={`conversation-message conversation-message--${message.role.toLowerCase()}`}
            data-role={message.role}
            key={message.id}
          >
            <div className="conversation-message-meta">
              <span>
                {message.role === "USER"
                  ? "你"
                  : message.role === "SYSTEM"
                    ? "系统"
                    : companionName}
              </span>
              <time dateTime={new Date(message.timestamp).toISOString()}>
                {formatMessageTime(message.timestamp)}
              </time>
            </div>
            <p>{message.text}</p>
          </article>
        ))}
        {isThinking ? (
          <div className="conversation-thinking" role="status">
            <span>{companionName}正在回应</span>
            <span className="thinking-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>
    </section>
  );
}
