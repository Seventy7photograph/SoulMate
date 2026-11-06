import { useCallback, useEffect, useRef, useState } from "react";

interface RecognitionResultLike {
  transcript: string;
}

interface RecognitionEventLike {
  results: ArrayLike<ArrayLike<RecognitionResultLike>>;
}

interface RecognitionErrorLike {
  error?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: RecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface UseSpeechRecognitionOptions {
  onResult: (text: string) => void;
  onError?: (message: string) => void;
  onWake?: () => void;
  companionName?: string;
}

function normalizedSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\s，。！？、,.!?~～:：；;'"“”‘’]/g, "");
}

export function matchesWakePhrase(
  transcript: string,
  companionName = "小雅",
): boolean {
  const normalized = normalizedSpeech(transcript);
  const name = normalizedSpeech(companionName);
  if (!name) {
    return false;
  }
  return [
    `你好${name}`,
    `嗨${name}`,
    `${name}${name}`,
    `hey${name}`,
  ].some((phrase) => normalized.includes(phrase));
}

export function useSpeechRecognition({
  onResult,
  onError,
  onWake,
  companionName = "小雅",
}: UseSpeechRecognitionOptions) {
  const [listening, setListening] = useState(false);
  const [wakeListening, setWakeListening] = useState(false);
  const [wakeDetected, setWakeDetected] = useState(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const wakeIntentRef = useRef(false);
  const wakeTimerRef = useRef<number | null>(null);
  const recognitionConstructor =
    typeof window === "undefined"
      ? null
      : ((window as unknown as {
          SpeechRecognition?: SpeechRecognitionConstructor;
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
        }).SpeechRecognition ??
        (window as unknown as {
          SpeechRecognition?: SpeechRecognitionConstructor;
          webkitSpeechRecognition?: SpeechRecognitionConstructor;
        }).webkitSpeechRecognition ??
        null);
  const supported = Boolean(recognitionConstructor);

  const clearWakeTimer = useCallback(() => {
    if (wakeTimerRef.current !== null) {
      window.clearTimeout(wakeTimerRef.current);
      wakeTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const stopWakeListening = useCallback(() => {
    wakeIntentRef.current = false;
    clearWakeTimer();
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    setWakeListening(false);
  }, [clearWakeTimer]);

  const start = useCallback(() => {
    if (!recognitionConstructor) {
      onError?.("当前浏览器不支持语音识别");
      return;
    }

    wakeIntentRef.current = false;
    clearWakeTimer();
    setWakeListening(false);
    recognitionRef.current?.abort();

    const recognition = new recognitionConstructor();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) {
        onResult(transcript);
      }
    };
    recognition.onerror = (event) => {
      setListening(false);
      onError?.(
        event.error === "not-allowed"
          ? "麦克风权限被拒绝"
          : "语音识别失败，请使用文字输入",
      );
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }, [clearWakeTimer, onError, onResult, recognitionConstructor]);

  const startWakeListening = useCallback(() => {
    if (!recognitionConstructor) {
      onError?.("当前浏览器不支持语音唤醒");
      return;
    }

    wakeIntentRef.current = true;
    setWakeListening(true);

    const begin = () => {
      if (!wakeIntentRef.current) {
        return;
      }
      const recognition = new recognitionConstructor();
      recognition.lang = "zh-CN";
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript ?? "")
          .join("");
        if (!matchesWakePhrase(transcript, companionName)) {
          return;
        }
        wakeIntentRef.current = false;
        clearWakeTimer();
        recognition.stop();
        recognitionRef.current = null;
        setWakeListening(false);
        setWakeDetected((count) => count + 1);
        onWake?.();
      };
      recognition.onerror = (event) => {
        if (event.error === "not-allowed") {
          wakeIntentRef.current = false;
          setWakeListening(false);
          onError?.("麦克风权限被拒绝");
        }
      };
      recognition.onend = () => {
        if (!wakeIntentRef.current) {
          return;
        }
        wakeTimerRef.current = window.setTimeout(begin, 420);
      };
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        wakeTimerRef.current = window.setTimeout(begin, 620);
      }
    };

    recognitionRef.current?.abort();
    begin();
  }, [
    clearWakeTimer,
    companionName,
    onError,
    onWake,
    recognitionConstructor,
  ]);

  useEffect(
    () => () => {
      wakeIntentRef.current = false;
      clearWakeTimer();
      recognitionRef.current?.abort();
    },
    [clearWakeTimer],
  );

  return {
    supported,
    listening,
    wakeListening,
    wakeDetected,
    start,
    stop,
    startWakeListening,
    stopWakeListening,
  };
}
