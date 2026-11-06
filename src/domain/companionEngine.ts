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

export function analyzeText(text: string): EmotionResult {
  const normalized = text.trim().toLowerCase();

  if (!normalized) {
    return {
      ...emotionFallbacks.IDLE,
      confidence: 0,
    };
  }

  if (
    /晚安|睡觉|困|打瞌睡|睡吧|好累|没力气|想休息|good night|sleepy/.test(
      normalized,
    )
  ) {
    return {
      ...emotionFallbacks.SLEEPY,
      confidence: 0.95,
    };
  }

  if (
    /生气|讨厌|烦死|气死|太过分|滚开|闭嘴|angry|hate/.test(
      normalized,
    )
  ) {
    return {
      ...emotionFallbacks.ANGRY,
      confidence: 0.88,
    };
  }

  if (
    /难过|不开心|失落|委屈|孤单|疲惫|伤心|焦虑|害怕|紧张|压力|崩溃|想哭|sad|anxious/.test(
      normalized,
    )
  ) {
    return {
      ...emotionFallbacks.SAD,
      confidence: 0.9,
    };
  }

  if (
    /摸摸|抱抱|贴贴|亲亲|可爱|喜欢你|爱你|想你|爱你哟|i love you/.test(
      normalized,
    )
  ) {
    return {
      ...emotionFallbacks.SHY,
      reply: pickVariant(normalized, [
        "唔，被你这么一说，我有点不好意思了。",
        "靠近一点也可以，我会好好记住这句话。",
        "你这样说，我的心情轻得像被风吹起来。",
      ]),
      confidence: 0.9,
    };
  }

  if (
    /好棒|很棒|真棒|厉害|开心|真好|做得好|顺利|成功|太好了|高兴|幸福|满足|great|happy/.test(
      normalized,
    )
  ) {
    return {
      ...emotionFallbacks.HAPPY,
      reply: pickVariant(normalized, [
        "我也跟着高兴起来了。今天值得好好庆祝一下。",
        "这件事听起来真不错，我想看你再多笑一会儿。",
        "收到这份好消息，我的心情也亮起来了。",
      ]),
      confidence: 0.9,
    };
  }

  if (
    /早安|早上好|上午好|你好|嗨|哈喽|hello|hi\b/.test(normalized)
  ) {
    return {
      ...emotionFallbacks.HAPPY,
      action: "WAVE",
      reply: pickVariant(normalized, [
        "早安，小雅已经准备好陪你开启今天了。",
        "你来啦。今天的第一个招呼，我认真收到了。",
        "早上好，先伸个懒腰，我们慢慢开始吧。",
      ]),
      confidence: 0.88,
    };
  }

  if (/我回来了|回来啦|想你了/.test(normalized)) {
    return {
      emotion: "HAPPY",
      action: "WAVE",
      reply: pickVariant(normalized, [
        "欢迎回来，我一直在这里等你。",
        "你回来啦。先歇一会儿，再慢慢告诉我今天发生了什么。",
      ]),
      confidence: 0.9,
    };
  }

  if (
    /早餐|早饭|午饭|午餐|晚饭|晚餐|吃什么|吃点什么|饿/.test(
      normalized,
    )
  ) {
    return {
      emotion: "HAPPY",
      action: "WAVE",
      reply: pickVariant(normalized, [
        "想吃点热乎的。汤面、饭团，或者一份刚出锅的早餐都好。",
        "如果让我选，我会偏向暖胃又不费心的东西。你现在方便吃什么？",
        "先别空着肚子。挑一份喜欢的，再慢慢决定今天怎么过。",
      ]),
      confidence: 0.86,
    };
  }

  if (/谢谢|感谢|多亏你|thanks|thank you/.test(normalized)) {
    return {
      emotion: "SHY",
      action: "WAVE",
      reply: pickVariant(normalized, [
        "这句谢谢我收下啦。能帮到你，我很开心。",
        "不用客气。你愿意告诉我，就已经很好了。",
      ]),
      confidence: 0.85,
    };
  }

  if (/对不起|抱歉|不好意思|sorry/.test(normalized)) {
    return {
      emotion: "SHY",
      action: "WAVE",
      reply: pickVariant(normalized, [
        "没关系，我没有把这点小事放在心上。",
        "不用一直责怪自己。愿意说出来，就已经很好了。",
      ]),
      confidence: 0.82,
    };
  }

  if (
    /你是谁|你叫什么|介绍一下你|小雅|你会做什么|能做什么|怎么用/.test(
      normalized,
    )
  ) {
    return {
      emotion: "HAPPY",
      action: "WAVE",
      reply: "我是小雅，住在这片会随心情变化的小世界里，想认真听你说话。",
      confidence: 0.82,
    };
  }

  if (
    /天气|下雨|晴天|下雪|刮风|温度|冷|热/.test(normalized)
  ) {
    return {
      emotion: "IDLE",
      action: "IDLE",
      reply: pickVariant(normalized, [
        "天气会变，这里的天空也会跟着变。你现在那边是什么样子？",
        "不管外面是晴是雨，你回来的时候这里都会亮着。",
      ]),
      confidence: 0.76,
    };
  }

  if (
    /上班|工作|学习|考试|加班|项目|论文|面试|老板|同事|作业|deadline/.test(
      normalized,
    )
  ) {
    return {
      emotion: "SAD",
      action: "IDLE",
      reply: pickVariant(normalized, [
        "听起来今天消耗了不少力气。先停一小会儿，我陪你缓一缓。",
        "这件事看起来不轻。你不用一下子全部扛完。",
      ]),
      confidence: 0.78,
    };
  }

  if (
    /音乐|电影|书|小说|游戏|动漫|散步|旅行|运动|跑步|咖啡|猫|狗|花/.test(
      normalized,
    )
  ) {
    return {
      emotion: "HAPPY",
      action: "WAVE",
      reply: pickVariant(normalized, [
        "这个听起来很有意思。你最喜欢它的哪一部分？",
        "我想多听一点。它让你今天的节奏慢下来了吗？",
        "把喜欢的东西讲给我听吧，我会认真记住。",
      ]),
      confidence: 0.74,
    };
  }

  if (/无聊|没事做|不知道做什么/.test(normalized)) {
    return {
      emotion: "HAPPY",
      action: "WAVE",
      reply: pickVariant(normalized, [
        "那我们来玩个轻松的小游戏：说一件今天让你稍微开心的事。",
        "无聊的时候，可以给我讲一个刚想到的念头，我陪你把它展开。",
      ]),
      confidence: 0.8,
    };
  }

  if (/再见|拜拜|先走了|下次聊|bye/.test(normalized)) {
    return {
      emotion: "SHY",
      action: "WAVE",
      reply: pickVariant(normalized, [
        "好，我在这里等你回来。",
        "下次见面时，再把没说完的话接着讲给我听。",
      ]),
      confidence: 0.8,
    };
  }

  if (/[?？]|吗$|什么|怎么|为什么|要不要/.test(normalized)) {
    return {
      emotion: "IDLE",
      action: "IDLE",
      reply: `我听见你在问「${quotedTopic(text)}」。我想先把你的感受放在答案前面，你现在更希望被安慰，还是想一起找办法？`,
      confidence: 0.68,
    };
  }

  return {
    emotion: "IDLE",
    action: "IDLE",
    reply: pickVariant(normalized, [
      `我听见了你在说「${quotedTopic(text)}」。我会在这里，你可以继续讲下去。`,
      `「${quotedTopic(text)}」这件事，我想再多听一点。它对你来说意味着什么？`,
      `我把这句话认真记住了。现在最想让我陪你聊哪一部分？`,
    ]),
    confidence: 0.6,
  };
}

