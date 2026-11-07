import semanticRules from "../../shared/companion-intents.json";

export type Emotion =
  | "IDLE"
  | "HAPPY"
  | "SHY"
  | "SAD"
  | "SLEEPY"
  | "ANGRY";

export type ActionId = "IDLE" | "JUMP" | "DANCE" | "WAVE" | "PUNCH" | "SIT";

export interface EmotionResult {
  emotion: Emotion;
  action: ActionId;
  reply: string;
  confidence: number;
}

export interface QuickAction extends EmotionResult {
  id: string;
  label: string;
  icon: "touch" | "praise" | "sleep";
}

interface SemanticRule {
  id: string;
  priority: number;
  emotion: Emotion;
  action: ActionId;
  confidence: number;
  patterns: string[];
  replies: string[];
}

const emotionFallbacks: Record<Emotion, Omit<EmotionResult, "confidence">> = {
  IDLE: {
    emotion: "IDLE",
    action: "IDLE",
    reply: "我在听。今天想和我聊点什么？",
  },
  HAPPY: {
    emotion: "HAPPY",
    action: "JUMP",
    reply: "你这么说，我心里一下子亮起来了。",
  },
  SHY: {
    emotion: "SHY",
    action: "WAVE",
    reply: "唔，被你摸到了。",
  },
  SAD: {
    emotion: "SAD",
    action: "IDLE",
    reply: "不用急着说话，我会安静陪着你。",
  },
  SLEEPY: {
    emotion: "SLEEPY",
    action: "SIT",
    reply: "声音轻一点，我有点困了。",
  },
  ANGRY: {
    emotion: "ANGRY",
    action: "PUNCH",
    reply: "哼，我听出来了，你有点不开心。",
  },
};

export const quickActions: QuickAction[] = [
  {
    ...emotionFallbacks.SHY,
    id: "pet",
    label: "摸摸头",
    icon: "touch",
    confidence: 1,
  },
  {
    ...emotionFallbacks.HAPPY,
    id: "praise",
    label: "夸夸它",
    icon: "praise",
    confidence: 1,
  },
  {
    ...emotionFallbacks.SLEEPY,
    id: "sleep",
    label: "哄它睡觉",
    icon: "sleep",
    confidence: 1,
  },
];

export function getEmotionFallback(emotion: Emotion): EmotionResult {
  return {
    ...emotionFallbacks[emotion],
    confidence: 1,
  };
}

function pickVariant(text: string, variants: string[]): string {
  let hash = 0;
  for (const character of text) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return variants[hash % variants.length];
}

function quotedTopic(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 20 ? `${compact.slice(0, 20)}…` : compact;
}

const compiledRules = (semanticRules as SemanticRule[])
  .slice()
  .sort((left, right) => right.priority - left.priority)
  .map((rule) => ({
    ...rule,
    matchers: rule.patterns.map(
      (pattern) => new RegExp(pattern, "iu"),
    ),
  }));

export function analyzeText(text: string): EmotionResult {
  const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();

  if (!normalized) {
    return {
      ...emotionFallbacks.IDLE,
      confidence: 0,
    };
  }

  for (const rule of compiledRules) {
    if (rule.matchers.some((matcher) => matcher.test(normalized))) {
      return {
        emotion: rule.emotion,
        action: rule.action,
        reply: pickVariant(normalized, rule.replies),
        confidence: rule.confidence,
      };
    }
  }

  if (
    /[?？]|(?:吗|么|呢|吧)[。！!？? ]*$|如何|怎么|为什么|为何|什么|哪里|哪儿|谁|多少|几点|能不能|可不可以|有没有|是否|要不要|帮我|请问/.test(
      normalized,
    )
  ) {
    return {
      emotion: "IDLE",
      action: "IDLE",
      reply: `我听见你在问「${quotedTopic(text)}」。如果需要实时或专业信息，我可能无法给准确答案；但我可以先陪你把思路理清。`,
      confidence: 0.68,
    };
  }

  return {
    emotion: "IDLE",
    action: "IDLE",
    reply: pickVariant(normalized, [
      `我听见了你在说「${quotedTopic(text)}」。我会在这里，你可以继续讲下去。`,
      `「${quotedTopic(text)}」这件事，我想再多听一点。它对你来说意味着什么？`,
      "我把这句话认真记住了。现在最想让我陪你聊哪一部分？",
    ]),
    confidence: 0.6,
  };
}

