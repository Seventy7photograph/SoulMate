import { useCallback } from "react";

export function useSpeechSynthesis() {
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const stop = useCallback(() => {
    if (supported) {
      window.speechSynthesis.cancel();
    }
  }, [supported]);

  const speak = useCallback(
    (text: string) => {
      if (!supported || !text.trim()) {
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "zh-CN";
      utterance.rate = 1;
      utterance.pitch = 1.05;
      window.speechSynthesis.speak(utterance);
    },
    [supported],
  );

  return { supported, speak, stop };
}

