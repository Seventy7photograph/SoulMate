import type { ActionId, Emotion } from "../domain/companionEngine";

export const ROBOT_MODEL = {
  id: "robot-expressive",
  path: "/models/RobotExpressive.glb",
  clips: [
    "Dance",
    "Death",
    "Idle",
    "Jump",
    "No",
    "Punch",
    "Running",
    "Sitting",
    "Standing",
    "ThumbsUp",
    "Walking",
    "WalkJump",
    "Wave",
    "Yes",
  ],
  morphTargets: ["Angry", "Surprised", "Sad"],
  attribution: "RobotExpressive by Tomas Laulhe, modified by Don McCurdy. CC0 1.0.",
} as const;

const intentToClip: Record<Emotion | ActionId, string> = {
  IDLE: "Idle",
  HAPPY: "Dance",
  SHY: "Wave",
  SAD: "Idle",
  SLEEPY: "Idle",
  ANGRY: "Punch",
  JUMP: "Jump",
  DANCE: "Dance",
  WAVE: "Wave",
  PUNCH: "Punch",
  SIT: "Sitting",
};

export function resolveAnimationClip(
  intent: Emotion | ActionId,
  availableClips: ReadonlySet<string>,
): string {
  const requested = intentToClip[intent];
  return availableClips.has(requested) ? requested : "Idle";
}

