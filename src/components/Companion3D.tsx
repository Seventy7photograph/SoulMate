import { useEffect, useRef, type RefObject } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  VRMLoaderPlugin,
  VRMUtils,
  type VRM,
} from "@pixiv/three-vrm";
import {
  ROBOT_MODEL,
  resolveAnimationClip,
} from "../assets/modelManifest";
import { CHARACTERS } from "../domain/characterConfig";
import type { ActionId, Emotion } from "../domain/companionEngine";
import type { GazePoint } from "../domain/gaze";
import type { CharacterId, LightingPreset } from "../domain/companionState";

interface Companion3DProps {
  action: ActionId;
  emotion: Emotion;
  characterId: CharacterId;
  accentColor: string;
  lighting: LightingPreset;
  gazeRef: RefObject<GazePoint>;
  viewCommand: {
    direction: "left" | "right" | "reset";
    nonce: number;
  };
  onReady: () => void;
  onProgress: (progress: number) => void;
  onError: (error: Error) => void;
}

interface ModelRuntime {
  kind: "glb" | "vrm";
  vrm: VRM | null;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction | undefined>;
  activeAction: THREE.AnimationAction | null;
  availableClips: Set<string>;
  head: THREE.Bone | null;
  neck: THREE.Bone | null;
  headBase: THREE.Euler | null;
  neckBase: THREE.Euler | null;
  morphMeshes: THREE.Mesh[];
  seedHead: THREE.Object3D | null;
  seedChest: THREE.Object3D | null;
  seedHips: THREE.Object3D | null;
  seedRightArm: THREE.Object3D | null;
  seedLeftArm: THREE.Object3D | null;
  seedSpine: THREE.Object3D | null;
  seedRightUpperLeg: THREE.Object3D | null;
  seedLeftUpperLeg: THREE.Object3D | null;
  seedRightLowerLeg: THREE.Object3D | null;
  seedLeftLowerLeg: THREE.Object3D | null;
  seedRoot: THREE.Object3D | null;
  seedRootBaseY: number;
  seedHeadBase: THREE.Euler | null;
  seedChestBase: THREE.Euler | null;
  seedHipsBase: THREE.Euler | null;
  seedRightArmBase: THREE.Euler | null;
  seedLeftArmBase: THREE.Euler | null;
  seedSpineBase: THREE.Euler | null;
  seedRightUpperLegBase: THREE.Euler | null;
  seedLeftUpperLegBase: THREE.Euler | null;
  seedRightLowerLegBase: THREE.Euler | null;
  seedLeftLowerLegBase: THREE.Euler | null;
  elapsed: number;
  smoothedGaze: GazePoint;
  seedActionElapsed: number;
  seedLastAction: ActionId;
  rootBaseRotation: THREE.Euler;
  accentLight: THREE.PointLight;
  onFinished: (event: { action: THREE.AnimationAction }) => void;
}

const loopClips = new Set(["Idle", "Dance", "Sitting"]);

const emotionMorphs: Record<
  Emotion,
  Partial<Record<"Angry" | "Surprised" | "Sad", number>>
> = {
  IDLE: {},
  HAPPY: {},
  SHY: { Surprised: 0.18, Sad: 0.12 },
  SAD: { Sad: 0.82 },
  SLEEPY: { Sad: 0.24 },
  ANGRY: { Angry: 0.9 },
};

const emotionLight: Record<Emotion, string> = {
  IDLE: "#ffb45e",
  HAPPY: "#ff9d32",
  SHY: "#e7847e",
  SAD: "#7596b8",
  SLEEPY: "#7d8fb5",
  ANGRY: "#dd744c",
};

function resolveLightColor(
  lighting: LightingPreset,
  emotion: Emotion,
  accentColor: string,
): string {
  if (lighting === "WARM") {
    return "#ff9f3f";
  }
  if (lighting === "NIGHT") {
    return "#7188b2";
  }
  return emotion === "IDLE" ? accentColor : emotionLight[emotion];
}

function playAnimation(
  runtime: ModelRuntime,
  action: ActionId,
  emotion: Emotion,
): void {
  const intent = action === "IDLE" ? emotion : action;
  const clipName = resolveAnimationClip(intent, runtime.availableClips);
  const next = runtime.actions[clipName];

  if (!next || next === runtime.activeAction) {
    return;
  }

  runtime.activeAction?.fadeOut(0.2);
  next.reset();
  next.setLoop(
    loopClips.has(clipName) ? THREE.LoopRepeat : THREE.LoopOnce,
    loopClips.has(clipName) ? Infinity : 1,
  );
  next.clampWhenFinished = clipName === "Sitting";
  next.fadeIn(0.22).play();
  runtime.activeAction = next;
}

function applyBoneGaze(
  runtime: ModelRuntime,
  gaze: GazePoint,
  action: ActionId,
  reducedMotion: boolean,
): void {
  const strength =
    (action === "IDLE" ? 1 : 0.55) *
    (reducedMotion ? 0.35 : 1);

  if (runtime.head && runtime.headBase) {
    runtime.head.rotation.x =
      runtime.headBase.x + gaze.y * 0.16 * strength;
    runtime.head.rotation.y =
      runtime.headBase.y + gaze.x * 0.34 * strength;
    runtime.head.rotation.z =
      runtime.headBase.z - gaze.x * 0.035 * strength;
  }

  if (runtime.neck && runtime.neckBase) {
    runtime.neck.rotation.x =
      runtime.neckBase.x + gaze.y * 0.07 * strength;
    runtime.neck.rotation.y =
      runtime.neckBase.y + gaze.x * 0.14 * strength;
  }

  if (runtime.seedHead && runtime.seedHeadBase) {
    runtime.seedHead.rotation.x += gaze.y * 0.13 * strength;
    runtime.seedHead.rotation.y += gaze.x * 0.24 * strength;
  }

  if (runtime.seedChest && runtime.seedChestBase) {
    runtime.seedChest.rotation.y += gaze.x * 0.05 * strength;
  }
}

interface SeedPose {
  rootY: number;
  hipsX: number;
  hipsZ: number;
  chestX: number;
  chestZ: number;
  headX: number;
  rightArmX: number;
  rightArmZ: number;
  leftArmX: number;
  leftArmZ: number;
  rightUpperLegX: number;
  leftUpperLegX: number;
  rightLowerLegX: number;
  leftLowerLegX: number;
}

function dampValue(
  current: number,
  target: number,
  lambda: number,
  delta: number,
): number {
  return THREE.MathUtils.damp(current, target, lambda, delta);
}

function applySeedAnimation(
  runtime: ModelRuntime,
  action: ActionId,
  emotion: Emotion,
  delta: number,
): void {
  runtime.elapsed += delta;
  const time = runtime.elapsed;
  if (runtime.seedLastAction !== action) {
    runtime.seedLastAction = action;
    runtime.seedActionElapsed = 0;
  }
  runtime.seedActionElapsed += delta;
  const actionTime = runtime.seedActionElapsed;
  const jumpProgress = Math.min(actionTime / 0.9, 1);
  const idle = {
    rootY: 0,
    hipsX: 0,
    hipsZ: Math.sin(time * 0.75) * 0.018,
    chestX:
      emotion === "SLEEPY"
        ? 0.07
        : emotion === "SAD"
          ? 0.035
          : Math.sin(time * 0.9) * 0.012,
    chestZ: Math.sin(time * 1.05) * 0.02,
    headX:
      emotion === "SAD"
        ? 0.08
        : emotion === "SLEEPY"
          ? 0.11
          : Math.sin(time * 0.58) * 0.012,
    rightArmX: 0,
    rightArmZ: Math.sin(time * 1.8) * 0.035,
    leftArmX: 0,
    leftArmZ: Math.sin(time * 1.6 + 0.4) * 0.035,
    rightUpperLegX: 0,
    leftUpperLegX: 0,
    rightLowerLegX: 0,
    leftLowerLegX: 0,
  };
  let target: SeedPose = idle;
  let damping = 7;

  if (action === "JUMP") {
    const airborne = Math.sin(jumpProgress * Math.PI);
    target = {
      ...idle,
      rootY: airborne * 0.2,
      hipsX: airborne * 0.08,
      chestX: -airborne * 0.06,
      rightArmZ: -airborne * 0.72,
      leftArmZ: airborne * 0.72,
      rightUpperLegX: -airborne * 0.42,
      leftUpperLegX: -airborne * 0.42,
      rightLowerLegX: airborne * 0.68,
      leftLowerLegX: airborne * 0.68,
    };
    damping = 13;
  } else if (action === "DANCE") {
    target = {
      ...idle,
      rootY: Math.sin(time * 5.2) * 0.035,
      hipsX: Math.sin(time * 5.2) * 0.07,
      hipsZ: Math.sin(time * 2.6) * 0.11,
      chestZ: Math.sin(time * 2.6 + 0.7) * 0.1,
      headX: Math.sin(time * 2.6) * 0.035,
      rightArmZ: -0.62 + Math.sin(time * 5.2) * 0.25,
      leftArmZ: 0.62 + Math.sin(time * 5.2 + Math.PI) * 0.25,
      rightUpperLegX: Math.sin(time * 2.6) * 0.09,
      leftUpperLegX: -Math.sin(time * 2.6) * 0.09,
    };
    damping = 10;
  } else if (action === "WAVE") {
    target = {
      ...idle,
      hipsZ: 0.025,
      chestZ: Math.sin(time * 2.2) * 0.035,
      headX: -0.025,
      rightArmX: -0.28,
      rightArmZ: -1.46 + Math.sin(time * 7.4) * 0.24,
      leftArmZ: 0.06,
    };
    damping = 12;
  } else if (action === "PUNCH") {
    const thrust = Math.sin(Math.min(actionTime / 0.45, 1) * Math.PI);
    target = {
      ...idle,
      rootY: -thrust * 0.018,
      hipsX: -thrust * 0.13,
      chestX: -thrust * 0.1,
      headX: -thrust * 0.04,
      rightArmX: -thrust * 0.72,
      rightArmZ: -thrust * 0.58,
      leftArmX: thrust * 0.14,
      leftArmZ: -0.1,
      rightUpperLegX: thrust * 0.16,
      leftUpperLegX: -thrust * 0.1,
    };
    damping = 14;
  } else if (action === "SIT") {
    target = {
      ...idle,
      rootY: -0.42,
      hipsX: -0.12,
      chestX: 0.2,
      headX: 0.16,
      rightArmX: -0.3,
      rightArmZ: 0.04,
      leftArmX: -0.3,
      leftArmZ: -0.04,
      rightUpperLegX: 1.52,
      leftUpperLegX: 1.52,
      rightLowerLegX: -2.02,
      leftLowerLegX: -2.02,
    };
    damping = 9;
  }

  if (runtime.seedRoot) {
    runtime.seedRoot.position.y = dampValue(
      runtime.seedRoot.position.y,
      runtime.seedRootBaseY + target.rootY,
      damping,
      delta,
    );
  }
  const applyEuler = (
    object: THREE.Object3D | null,
    base: THREE.Euler | null,
    x: number,
    y: number,
    z: number,
  ) => {
    if (!object || !base) {
      return;
    }
    object.rotation.x = dampValue(object.rotation.x, base.x + x, damping, delta);
    object.rotation.y = dampValue(object.rotation.y, base.y + y, damping, delta);
    object.rotation.z = dampValue(object.rotation.z, base.z + z, damping, delta);
  };

  applyEuler(runtime.seedHips, runtime.seedHipsBase, target.hipsX, 0, target.hipsZ);
  applyEuler(runtime.seedChest, runtime.seedChestBase, target.chestX, 0, target.chestZ);
  applyEuler(runtime.seedSpine, runtime.seedSpineBase, target.chestX * 0.55, 0, target.chestZ * 0.55);
  applyEuler(runtime.seedHead, runtime.seedHeadBase, target.headX, 0, 0);
  applyEuler(
    runtime.seedRightArm,
    runtime.seedRightArmBase,
    target.rightArmX,
    0,
    1.02 + target.rightArmZ,
  );
  applyEuler(
    runtime.seedLeftArm,
    runtime.seedLeftArmBase,
    target.leftArmX,
    0,
    -1.02 + target.leftArmZ,
  );
  applyEuler(
    runtime.seedRightUpperLeg,
    runtime.seedRightUpperLegBase,
    target.rightUpperLegX,
    0,
    0,
  );
  applyEuler(
    runtime.seedLeftUpperLeg,
    runtime.seedLeftUpperLegBase,
    target.leftUpperLegX,
    0,
    0,
  );
  applyEuler(
    runtime.seedRightLowerLeg,
    runtime.seedRightLowerLegBase,
    target.rightLowerLegX,
    0,
    0,
  );
  applyEuler(
    runtime.seedLeftLowerLeg,
    runtime.seedLeftLowerLegBase,
    target.leftLowerLegX,
    0,
    0,
  );

  const expression = runtime.vrm?.expressionManager;
  if (expression) {
    expression.setValue(
      "happy",
      emotion === "HAPPY" ? 0.72 : 0,
    );
    expression.setValue("sad", emotion === "SAD" ? 0.72 : 0);
    expression.setValue("angry", emotion === "ANGRY" ? 0.7 : 0);
    expression.setValue(
      "relaxed",
      emotion === "SLEEPY" ? 0.68 : 0,
    );
    expression.setValue(
      "surprised",
      emotion === "SHY" ? 0.26 : 0,
    );
    expression.setValue("blink", time % 4.3 > 4.18 ? 1 : 0);
  }
}

function applyMorphTargets(
  runtime: ModelRuntime,
  emotion: Emotion,
  delta: number,
): void {
  const targets = emotionMorphs[emotion];
  const blend = 1 - Math.exp(-8 * delta);

  runtime.morphMeshes.forEach((mesh) => {
    const dictionary = mesh.morphTargetDictionary ?? {};
    const influences = mesh.morphTargetInfluences;
    if (!influences) {
      return;
    }

    Object.entries(targets).forEach(([name, target]) => {
      const index = dictionary[name];
      if (index !== undefined && target !== undefined) {
        influences[index] = THREE.MathUtils.lerp(
          influences[index] ?? 0,
          target,
          blend,
        );
      }
    });

    ROBOT_MODEL.morphTargets.forEach((name) => {
      if (name in targets) {
        return;
      }
      const index = dictionary[name];
      if (index !== undefined) {
        influences[index] = THREE.MathUtils.lerp(
          influences[index] ?? 0,
          0,
          blend,
        );
      }
    });
  });
}

function disposeMaterial(material: THREE.Material): void {
  const texturedMaterial = material as THREE.Material & {
    map?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
    roughnessMap?: THREE.Texture | null;
    metalnessMap?: THREE.Texture | null;
    emissiveMap?: THREE.Texture | null;
  };

  texturedMaterial.map?.dispose();
  texturedMaterial.normalMap?.dispose();
  texturedMaterial.roughnessMap?.dispose();
  texturedMaterial.metalnessMap?.dispose();
  texturedMaterial.emissiveMap?.dispose();
  material.dispose();
}

export function Companion3D({
  action,
  emotion,
  characterId,
  accentColor,
  lighting,
  gazeRef,
  viewCommand,
  onReady,
  onProgress,
  onError,
}: Companion3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ModelRuntime | null>(null);
  const actionRef = useRef(action);
  const emotionRef = useRef(emotion);
  const lightingRef = useRef(lighting);
  const accentColorRef = useRef(accentColor);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const homeCameraRef = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
  } | null>(null);

  useEffect(() => {
    actionRef.current = action;
    if (runtimeRef.current) {
      playAnimation(runtimeRef.current, action, emotionRef.current);
    }
  }, [action]);

  useEffect(() => {
    emotionRef.current = emotion;
    const runtime = runtimeRef.current;
    if (runtime && lightingRef.current === "AUTO") {
      runtime.accentLight.color.set(
        resolveLightColor("AUTO", emotion, accentColorRef.current),
      );
    }
  }, [emotion]);

  useEffect(() => {
    lightingRef.current = lighting;
    runtimeRef.current?.accentLight.color.set(
      resolveLightColor(
        lighting,
        emotionRef.current,
        accentColorRef.current,
      ),
    );
  }, [lighting]);

  useEffect(() => {
    accentColorRef.current = accentColor;
    if (lightingRef.current === "AUTO") {
      runtimeRef.current?.accentLight.color.set(
        resolveLightColor("AUTO", emotionRef.current, accentColor),
      );
    }
  }, [accentColor]);

  useEffect(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) {
      return;
    }
    if (controls.domElement) {
      controls.domElement.dataset.viewInteracted = "true";
    }

    if (viewCommand.direction === "reset" && homeCameraRef.current) {
      camera.position.copy(homeCameraRef.current.position);
      controls.target.copy(homeCameraRef.current.target);
      controls.update();
      return;
    }

    if (viewCommand.direction === "reset") {
      return;
    }

    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta +=
      viewCommand.direction === "left" ? Math.PI / 10 : -Math.PI / 10;
    spherical.theta = THREE.MathUtils.clamp(
      spherical.theta,
      controls.minAzimuthAngle,
      controls.maxAzimuthAngle,
    );
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    controls.update();
  }, [viewCommand]);

  useEffect(() => {
    const container = containerRef.current;
    const characterConfig = CHARACTERS[characterId];
    if (!container || !characterConfig.modelPath) {
      return undefined;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch (error) {
      onError(
        error instanceof Error ? error : new Error("WebGL initialization failed"),
      );
      return undefined;
    }

    let disposed = false;
    let animationFrame: number | null = null;
    let loadedRoot: THREE.Group | null = null;
    const timer = new THREE.Timer();

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = "companion-canvas";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    camera.position.set(...characterConfig.cameraPosition);
    camera.lookAt(...characterConfig.cameraTarget);
    cameraRef.current = camera;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = characterConfig.kind === "vrm" ? 4.2 : 6.8;
    controls.maxDistance = characterConfig.kind === "vrm" ? 11 : 16;
    controls.minPolarAngle = Math.PI * 0.28;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.minAzimuthAngle = -Math.PI * 0.22;
    controls.maxAzimuthAngle = Math.PI * 0.22;
    controls.rotateSpeed = 0.62;
    controls.zoomSpeed = 0.72;
    controls.target.set(...characterConfig.cameraTarget);
    controls.update();
    const markViewInteracted = () => {
      renderer.domElement.dataset.viewInteracted = "true";
    };
    controls.addEventListener("start", markViewInteracted);
    controlsRef.current = controls;
    homeCameraRef.current = {
      position: new THREE.Vector3(...characterConfig.cameraPosition),
      target: new THREE.Vector3(...characterConfig.cameraTarget),
    };

    const ambient = new THREE.AmbientLight(0xfff2dc, 1.55);
    const sun = new THREE.DirectionalLight(0xfff4df, 2.9);
    sun.position.set(3.5, 6.5, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -3;
    sun.shadow.camera.right = 3;
    sun.shadow.camera.top = 5;
    sun.shadow.camera.bottom = -1;
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 20;
    const accentLight = new THREE.PointLight(
      resolveLightColor(
        lightingRef.current,
        emotionRef.current,
        accentColorRef.current,
      ),
      15,
      18,
      1.6,
    );
    accentLight.position.set(-4, 3.8, 4);
    const mintFill = new THREE.PointLight(0xd9f7ee, 8, 14, 1.7);
    mintFill.position.set(3.6, 2.2, 3.8);
    scene.add(ambient, sun, accentLight, mintFill);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 64),
      new THREE.ShadowMaterial({ opacity: 0.22, color: 0x6d5639 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.015;
    shadow.receiveShadow = true;
    scene.add(shadow);

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const loader = new GLTFLoader();
    if (characterConfig.kind === "vrm") {
      loader.register((parser) => new VRMLoaderPlugin(parser));
    }
    loader.load(
      characterConfig.modelPath,
      (gltf) => {
        if (disposed) {
          gltf.scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) {
              return;
            }
            object.geometry.dispose();
            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];
            materials.forEach(disposeMaterial);
          });
          return;
        }

        const vrm =
          characterConfig.kind === "vrm"
            ? (gltf.userData.vrm as VRM | undefined) ?? null
            : null;
        if (vrm) {
          VRMUtils.removeUnnecessaryVertices(vrm.scene);
        }

        loadedRoot = vrm?.scene ?? gltf.scene;
        loadedRoot.scale.setScalar(characterConfig.scale);
        loadedRoot.position.y = characterConfig.yOffset;
        loadedRoot.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.castShadow = true;
            object.receiveShadow = true;
          }
        });
        scene.add(loadedRoot);

        const actions: Record<string, THREE.AnimationAction | undefined> = {};
        gltf.animations.forEach((clip) => {
          actions[clip.name] = undefined;
        });

        const mixer = new THREE.AnimationMixer(loadedRoot);
        gltf.animations.forEach((clip) => {
          actions[clip.name] = mixer.clipAction(clip);
        });

        const foundBones: {
          head: THREE.Bone | null;
          neck: THREE.Bone | null;
        } = { head: null, neck: null };
        const morphMeshes: THREE.Mesh[] = [];
        loadedRoot.traverse((object) => {
          if (object instanceof THREE.Bone) {
            if (object.name === "Head") {
              foundBones.head = object;
            }
            if (object.name === "Neck") {
              foundBones.neck = object;
            }
          }
          if (
            object instanceof THREE.Mesh &&
            object.morphTargetDictionary &&
            object.morphTargetInfluences
          ) {
            morphMeshes.push(object);
          }
        });

        const seedHead =
          vrm?.humanoid.getNormalizedBoneNode("head") ?? null;
        const seedChest =
          vrm?.humanoid.getNormalizedBoneNode("chest") ?? null;
        const seedHips =
          vrm?.humanoid.getNormalizedBoneNode("hips") ?? null;
        const seedRightArm =
          vrm?.humanoid.getNormalizedBoneNode("rightUpperArm") ?? null;
        const seedLeftArm =
          vrm?.humanoid.getNormalizedBoneNode("leftUpperArm") ?? null;
        const seedSpine =
          vrm?.humanoid.getNormalizedBoneNode("spine") ?? null;
        const seedRightUpperLeg =
          vrm?.humanoid.getNormalizedBoneNode("rightUpperLeg") ?? null;
        const seedLeftUpperLeg =
          vrm?.humanoid.getNormalizedBoneNode("leftUpperLeg") ?? null;
        const seedRightLowerLeg =
          vrm?.humanoid.getNormalizedBoneNode("rightLowerLeg") ?? null;
        const seedLeftLowerLeg =
          vrm?.humanoid.getNormalizedBoneNode("leftLowerLeg") ?? null;
        const seedRoot = vrm?.scene ?? null;

        const runtime: ModelRuntime = {
          kind: vrm ? "vrm" : "glb",
          vrm,
          mixer,
          actions,
          activeAction: null,
          availableClips: new Set(gltf.animations.map((clip) => clip.name)),
          head: foundBones.head,
          neck: foundBones.neck,
          headBase: foundBones.head?.rotation.clone() ?? null,
          neckBase: foundBones.neck?.rotation.clone() ?? null,
          morphMeshes,
          seedHead,
          seedChest,
          seedHips,
          seedRightArm,
          seedLeftArm,
          seedSpine,
          seedRightUpperLeg,
          seedLeftUpperLeg,
          seedRightLowerLeg,
          seedLeftLowerLeg,
          seedRoot,
          seedRootBaseY: seedRoot?.position.y ?? 0,
          seedHeadBase: seedHead?.rotation.clone() ?? null,
          seedChestBase: seedChest?.rotation.clone() ?? null,
          seedHipsBase: seedHips?.rotation.clone() ?? null,
          seedRightArmBase: seedRightArm?.rotation.clone() ?? null,
          seedLeftArmBase: seedLeftArm?.rotation.clone() ?? null,
          seedSpineBase: seedSpine?.rotation.clone() ?? null,
          seedRightUpperLegBase:
            seedRightUpperLeg?.rotation.clone() ?? null,
          seedLeftUpperLegBase:
            seedLeftUpperLeg?.rotation.clone() ?? null,
          seedRightLowerLegBase:
            seedRightLowerLeg?.rotation.clone() ?? null,
          seedLeftLowerLegBase:
            seedLeftLowerLeg?.rotation.clone() ?? null,
          elapsed: 0,
          smoothedGaze: { x: 0, y: 0 },
          seedActionElapsed: 0,
          seedLastAction: "IDLE",
          rootBaseRotation: loadedRoot.rotation.clone(),
          accentLight,
          onFinished: () => undefined,
        };

        runtime.onFinished = (event) => {
          const clipName = event.action.getClip().name;
          if (loopClips.has(clipName) || clipName === "Idle") {
            return;
          }

          const idle = actions.Idle;
          if (idle) {
            event.action.fadeOut(0.25);
            idle.reset().fadeIn(0.3).play();
            runtime.activeAction = idle;
          }
        };

        mixer.addEventListener("finished", runtime.onFinished);
        runtimeRef.current = runtime;
        playAnimation(runtime, actionRef.current, emotionRef.current);
        accentLight.color.set(
          resolveLightColor(
            lightingRef.current,
            emotionRef.current,
            accentColorRef.current,
          ),
        );
        onProgress(100);
        onReady();
      },
      (progressEvent) => {
        if (progressEvent.total > 0) {
          onProgress((progressEvent.loaded / progressEvent.total) * 100);
        }
      },
      (error) => {
        onError(error instanceof Error ? error : new Error("Model load failed"));
      },
    );

    let lastGaze = { x: 0, y: 0 };
    let lastGazeAt = 0;
    let nextGlanceAt = 3.2;
    let glanceTarget = { x: 0, y: 0 };
    const automaticGaze = { x: 0, y: 0 };

    const render = (timestamp: number) => {
      if (disposed) {
        return;
      }

      timer.update(timestamp);
      const now = timestamp / 1000;
      const runtime = runtimeRef.current;
      if (runtime) {
        const delta = timer.getDelta();
        if (runtime.kind === "glb") {
          runtime.mixer.update(delta);
        } else {
          applySeedAnimation(
            runtime,
            actionRef.current,
            emotionRef.current,
            delta,
          );
        }
        const pointerGaze = gazeRef.current ?? { x: 0, y: 0 };
        const gazeChanged =
          Math.abs(pointerGaze.x - lastGaze.x) > 0.018 ||
          Math.abs(pointerGaze.y - lastGaze.y) > 0.018;
        if (gazeChanged) {
          lastGazeAt = now;
          lastGaze = { ...pointerGaze };
        }
        if (!reducedMotion && now - lastGazeAt > 2.8) {
          if (now >= nextGlanceAt) {
            glanceTarget = {
              x: (Math.random() - 0.5) * 0.72,
              y: (Math.random() - 0.5) * 0.32,
            };
            nextGlanceAt = now + 3.6 + Math.random() * 3.8;
          }
          automaticGaze.x = THREE.MathUtils.damp(
            automaticGaze.x,
            glanceTarget.x,
            1.1,
            delta,
          );
          automaticGaze.y = THREE.MathUtils.damp(
            automaticGaze.y,
            glanceTarget.y,
            1.1,
            delta,
          );
          gazeRef.current = { ...automaticGaze };
        } else if (gazeChanged) {
          automaticGaze.x = pointerGaze.x;
          automaticGaze.y = pointerGaze.y;
        }
        if (loadedRoot) {
          const sway = reducedMotion ? 0 : Math.sin(runtime.elapsed * 0.62);
          loadedRoot.rotation.x =
            runtime.rootBaseRotation.x + sway * 0.005;
          loadedRoot.rotation.z =
            runtime.rootBaseRotation.z + Math.sin(runtime.elapsed * 0.47) * 0.006;
        }
        const targetGaze = gazeRef.current ?? { x: 0, y: 0 };
        runtime.smoothedGaze.x = THREE.MathUtils.damp(
          runtime.smoothedGaze.x,
          targetGaze.x,
          5,
          delta,
        );
        runtime.smoothedGaze.y = THREE.MathUtils.damp(
          runtime.smoothedGaze.y,
          targetGaze.y,
          5,
          delta,
        );
        applyBoneGaze(
          runtime,
          runtime.smoothedGaze,
          actionRef.current,
          reducedMotion,
        );
        if (runtime.kind === "glb") {
          applyMorphTargets(runtime, emotionRef.current, delta);
        } else {
          runtime.vrm?.update(delta);
        }
      }

      controls.update();
      renderer.render(scene, camera);
      animationFrame = window.requestAnimationFrame(render);
    };
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      disposed = true;
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      resizeObserver.disconnect();

      const runtime = runtimeRef.current;
      if (runtime) {
        runtime.mixer.removeEventListener("finished", runtime.onFinished);
        runtime.mixer.stopAllAction();
      }
      runtimeRef.current = null;
      controls.dispose();
      controlsRef.current = null;
      cameraRef.current = null;
      homeCameraRef.current = null;

      if (loadedRoot) {
        loadedRoot.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) {
            return;
          }
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach(disposeMaterial);
        });
      }

      shadow.geometry.dispose();
      (shadow.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [characterId, gazeRef, onError, onProgress, onReady]);

  return <div ref={containerRef} className="companion-3d-host" />;
}

