import {
  useEffect,
  useRef,
  type RefObject,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  KAYKIT_COMPANION,
  resolveKayKitCharacter,
  resolveKayKitClip,
} from "../assets/kayKitCompanion";
import type {
  ActionId,
  Emotion,
} from "../domain/companionEngine";
import type { GazePoint } from "../domain/gaze";
import type { LightingPreset } from "../domain/companionState";
import type { CharacterId } from "../domain/companionState";

interface KayKitCompanion3DProps {
  characterId: CharacterId;
  action: ActionId;
  actionNonce: number;
  emotion: Emotion;
  engagement: "IDLE" | "LISTENING" | "THINKING";
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

interface KayKitRuntime {
  root: THREE.Group;
  host: HTMLDivElement;
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  availableClips: ReadonlySet<string>;
  activeAction: THREE.AnimationAction | null;
  activeClip: string;
  ambientAction: THREE.AnimationAction | null;
  ambientClip: string | null;
  nextAmbientAt: number;
  head: THREE.Object3D | null;
  headAnimationQuaternion: THREE.Quaternion;
  gazeEuler: THREE.Euler;
  gazeQuaternion: THREE.Quaternion;
  rootBaseRotation: THREE.Euler;
  smoothedGaze: GazePoint;
  accentLight: THREE.PointLight;
  elapsed: number;
  reducedMotion: boolean;
}

const actionDurationHints: Partial<Record<ActionId, number>> = {
  JUMP: 900,
  WAVE: 2300,
  PUNCH: 1200,
};

const lightColor: Record<Emotion, string> = {
  IDLE: "#ffd08a",
  HAPPY: "#ffcc72",
  SHY: "#f5a99a",
  SAD: "#8eb3c8",
  SLEEPY: "#a3b7d3",
  ANGRY: "#e89a72",
};

function resolveLightColor(
  lighting: LightingPreset,
  emotion: Emotion,
  accentColor: string,
): string {
  if (lighting === "WARM") {
    return "#ffc46c";
  }
  if (lighting === "NIGHT") {
    return "#8ca9d0";
  }
  return emotion === "IDLE" ? accentColor : lightColor[emotion];
}

function disposeMaterial(material: THREE.Material): void {
  const textured = material as THREE.Material & {
    map?: THREE.Texture | null;
    normalMap?: THREE.Texture | null;
  };
  textured.map?.dispose();
  textured.normalMap?.dispose();
  material.dispose();
}

export function KayKitCompanion3D({
  characterId,
  action,
  actionNonce,
  emotion,
  engagement,
  accentColor,
  lighting,
  gazeRef,
  viewCommand,
  onReady,
  onProgress,
  onError,
}: KayKitCompanion3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<KayKitRuntime | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const homeCameraRef = useRef<{
    position: THREE.Vector3;
    target: THREE.Vector3;
  } | null>(null);
  const actionRef = useRef(action);
  const previousActionRef = useRef(action);
  const emotionRef = useRef(emotion);
  const engagementRef = useRef(engagement);
  const lightingRef = useRef(lighting);
  const accentColorRef = useRef(accentColor);

  useEffect(() => {
    const previousAction = previousActionRef.current;
    previousActionRef.current = action;
    actionRef.current = action;
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    runtime.ambientAction?.fadeOut(0.18);
    runtime.ambientAction = null;
    runtime.ambientClip = null;
    runtime.nextAmbientAt = runtime.elapsed + 7 + Math.random() * 8;
    playClip(
      runtime,
      action === "IDLE"
        ? resolveIdleClip(
            emotionRef.current,
            engagementRef.current,
            runtime.availableClips,
          )
        : resolveKayKitClip(action, runtime.availableClips),
      action,
      !(action === "IDLE" && previousAction !== "IDLE"),
    );
  }, [action, actionNonce]);

  useEffect(() => {
    emotionRef.current = emotion;
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    if (actionRef.current === "IDLE") {
      playClip(
        runtime,
        resolveIdleClip(
          emotion,
          engagementRef.current,
          runtime.availableClips,
        ),
        "IDLE",
      );
    }
    if (lightingRef.current === "AUTO") {
      runtime.accentLight.color.set(
        resolveLightColor("AUTO", emotion, accentColorRef.current),
      );
    }
  }, [emotion]);

  useEffect(() => {
    engagementRef.current = engagement;
    const runtime = runtimeRef.current;
    if (
      !runtime ||
      actionRef.current !== "IDLE" ||
      runtime.ambientAction
    ) {
      return;
    }
    playClip(
      runtime,
      resolveIdleClip(
        emotionRef.current,
        engagement,
        runtime.availableClips,
      ),
      "IDLE",
    );
  }, [engagement]);

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
        resolveLightColor(
          "AUTO",
          emotionRef.current,
          accentColor,
        ),
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
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta +=
      viewCommand.direction === "left" ? Math.PI / 14 : -Math.PI / 14;
    spherical.theta = THREE.MathUtils.clamp(
      spherical.theta,
      controls.minAzimuthAngle,
      controls.maxAzimuthAngle,
    );
    camera.position.copy(
      controls.target.clone().add(offset.setFromSpherical(spherical)),
    );
    controls.update();
  }, [viewCommand]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return undefined;
    }

    let disposed = false;
    let animationFrame: number | null = null;
    let loadedRoot: THREE.Group | null = null;
    const timer = new THREE.Timer();
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = "companion-canvas";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const profile = resolveKayKitCharacter(characterId);
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 80);
    camera.position.set(0, 1.55, 6.6);
    camera.lookAt(0, 1.18, 0);
    cameraRef.current = camera;

    const ambient = new THREE.HemisphereLight(0xfff6e4, 0x668477, 2.2);
    const sun = new THREE.DirectionalLight(0xfff2d6, 3.1);
    sun.position.set(2.8, 5.8, 4.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -2.5;
    sun.shadow.camera.right = 2.5;
    sun.shadow.camera.top = 4;
    sun.shadow.camera.bottom = -1;
    const accentLight = new THREE.PointLight(
      resolveLightColor(lightingRef.current, emotionRef.current, accentColorRef.current),
      9,
      12,
      1.8,
    );
    accentLight.position.set(-2.8, 2.8, 3.4);
    const fill = new THREE.PointLight(0xc8f5e8, 4.5, 10, 1.8);
    fill.position.set(3.2, 2, 2.8);
    scene.add(ambient, sun, accentLight, fill);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 64),
      new THREE.ShadowMaterial({
        opacity: 0.2,
        color: 0x385047,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.002;
    shadow.receiveShadow = true;
    scene.add(shadow);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.minDistance = 3.4;
    controls.maxDistance = 7.6;
    controls.minPolarAngle = Math.PI * 0.33;
    controls.maxPolarAngle = Math.PI * 0.55;
    controls.minAzimuthAngle = -Math.PI * 0.22;
    controls.maxAzimuthAngle = Math.PI * 0.22;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 0.65;
    controls.target.set(0, 1.18, 0);
    controls.update();
    controlsRef.current = controls;
    homeCameraRef.current = {
      position: camera.position.clone(),
      target: controls.target.clone(),
    };
    const markViewInteracted = () => {
      renderer.domElement.dataset.viewInteracted = "true";
    };
    controls.addEventListener("start", markViewInteracted);

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

    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => {
      onProgress(total > 0 ? (loaded / total) * 100 : 0);
    };
    const loader = new GLTFLoader(manager);
    const load = async () => {
      const modelGltf = await loader.loadAsync(profile.modelPath);
      if (disposed) {
        return;
      }
      loadedRoot = modelGltf.scene;
      const bones = new Map<string, THREE.Bone>();
      loadedRoot.traverse((object) => {
        if (object instanceof THREE.Bone) {
          bones.set(object.name, object);
        }
        if (object instanceof THREE.Mesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          object.frustumCulled = false;
        }
      });

      loadedRoot.updateMatrixWorld(true);
      const initialBox = new THREE.Box3().setFromObject(loadedRoot);
      const initialSize = initialBox.getSize(new THREE.Vector3());
      const targetHeight = profile.targetHeight;
      const modelScale =
        initialSize.y > 0 ? targetHeight / initialSize.y : 1;
      loadedRoot.scale.setScalar(modelScale);
      loadedRoot.updateMatrixWorld(true);
      const scaledBox = new THREE.Box3().setFromObject(loadedRoot);
      const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
      loadedRoot.position.x -= scaledCenter.x;
      loadedRoot.position.z -= scaledCenter.z;
      loadedRoot.position.y -= scaledBox.min.y;
      loadedRoot.updateMatrixWorld(true);
      scene.add(loadedRoot);

      const animationGltfs = await Promise.all(
        KAYKIT_COMPANION.animationFiles.map((path) =>
          loader.loadAsync(path),
        ),
      );
      if (disposed) {
        return;
      }
      const mixer = new THREE.AnimationMixer(loadedRoot);
      const actions = new Map<string, THREE.AnimationAction>();
      const availableClips = new Set<string>();
      for (const gltf of animationGltfs) {
        for (const sourceClip of gltf.animations) {
          if (sourceClip.name === "T-Pose") {
            continue;
          }
          const tracks = sourceClip.tracks.filter((track) =>
            bones.has(track.name.split(".")[0]) &&
            !track.name.startsWith("root."),
          );
          if (tracks.length === 0) {
            continue;
          }
          const clip = new THREE.AnimationClip(
            sourceClip.name,
            sourceClip.duration,
            tracks,
          );
          availableClips.add(clip.name);
          actions.set(clip.name, mixer.clipAction(clip));
        }
      }

      const runtime: KayKitRuntime = {
        root: loadedRoot,
        host: container,
        mixer,
        actions,
        availableClips,
        activeAction: null,
        activeClip: "",
        ambientAction: null,
        ambientClip: null,
        nextAmbientAt: nextAmbientDelay(emotionRef.current),
        head: bones.get("head") ?? null,
        headAnimationQuaternion: new THREE.Quaternion(),
        gazeEuler: new THREE.Euler(0, 0, 0, "YXZ"),
        gazeQuaternion: new THREE.Quaternion(),
        rootBaseRotation: loadedRoot.rotation.clone(),
        smoothedGaze: { x: 0, y: 0 },
        accentLight,
        elapsed: 0,
        reducedMotion,
      };
      if (runtime.head) {
        runtime.headAnimationQuaternion.copy(runtime.head.quaternion);
      }

      mixer.addEventListener("finished", (event) => {
        if (
          runtime.ambientAction &&
          event.action === runtime.ambientAction
        ) {
          runtime.ambientAction = null;
          runtime.ambientClip = null;
          if (actionRef.current === "IDLE") {
            playClip(
              runtime,
              resolveIdleClip(
                emotionRef.current,
                engagementRef.current,
                runtime.availableClips,
              ),
              "IDLE",
              false,
            );
          }
        }
      });

      runtimeRef.current = runtime;
      playClip(
        runtime,
        actionRef.current === "IDLE"
          ? resolveIdleClip(
              emotionRef.current,
              engagementRef.current,
              availableClips,
            )
          : resolveKayKitClip(actionRef.current, availableClips),
        actionRef.current,
      );
      accentLight.color.set(
        resolveLightColor(
          lightingRef.current,
          emotionRef.current,
          accentColorRef.current,
        ),
      );
      onProgress(100);
      onReady();
    };
    void load().catch((error) => {
      onError(error instanceof Error ? error : new Error("Model load failed"));
    });

    const render = (timestamp: number) => {
      if (disposed) {
        return;
      }
      timer.update(timestamp);
      const delta = timer.getDelta();
      const runtime = runtimeRef.current;
      if (runtime) {
        runtime.elapsed += delta;
        if (runtime.head) {
          runtime.head.quaternion.copy(
            runtime.headAnimationQuaternion,
          );
        }
        runtime.mixer.update(delta);
        const gaze = gazeRef.current ?? { x: 0, y: 0 };
        runtime.smoothedGaze.x = THREE.MathUtils.damp(
          runtime.smoothedGaze.x,
          gaze.x,
          4.8,
          delta,
        );
        runtime.smoothedGaze.y = THREE.MathUtils.damp(
          runtime.smoothedGaze.y,
          gaze.y,
          4.8,
          delta,
        );
        if (runtime.head) {
          runtime.headAnimationQuaternion.copy(runtime.head.quaternion);
          const tracking =
            actionRef.current === "IDLE" ? 1 : 0.62;
          const listening =
            engagementRef.current === "LISTENING" ? 1 : 0;
          const thinking =
            engagementRef.current === "THINKING" ? 1 : 0;
          const nod =
            Math.sin(runtime.elapsed * (thinking ? 2.5 : 1.35)) *
            (thinking ? 0.022 : listening ? 0.012 : 0);
          runtime.gazeEuler.set(
            THREE.MathUtils.clamp(
              runtime.smoothedGaze.y * 0.095 * tracking + nod,
              -0.13,
              0.13,
            ),
            THREE.MathUtils.clamp(
              runtime.smoothedGaze.x * 0.24 * tracking,
              -0.29,
              0.29,
            ),
            THREE.MathUtils.clamp(
              -runtime.smoothedGaze.x * 0.025 * tracking +
                listening * 0.025,
              -0.045,
              0.065,
            ),
            "YXZ",
          );
          runtime.gazeQuaternion.setFromEuler(runtime.gazeEuler);
          runtime.head.quaternion.multiply(runtime.gazeQuaternion);
          renderer.domElement.dataset.gazeX =
            runtime.smoothedGaze.x.toFixed(3);
          renderer.domElement.dataset.gazeY =
            runtime.smoothedGaze.y.toFixed(3);
        }
        if (
          !runtime.reducedMotion &&
          actionRef.current === "IDLE" &&
          engagementRef.current === "IDLE" &&
          !runtime.ambientAction &&
          runtime.elapsed >= runtime.nextAmbientAt
        ) {
          const candidates = ambientClipsForEmotion(
            emotionRef.current,
          ).filter(
            (clip) =>
              clip !== runtime.activeClip &&
              runtime.availableClips.has(clip),
          );
          if (candidates.length > 0) {
            const clip =
              candidates[
                Math.floor(Math.random() * candidates.length)
              ];
            const action = runtime.actions.get(clip);
            if (action) {
              action.reset();
              action.setLoop(THREE.LoopOnce, 1);
              action.clampWhenFinished = true;
              action.setEffectiveWeight(1);
              action.fadeIn(0.25).play();
              runtime.activeAction?.fadeOut(0.2);
              runtime.activeAction = action;
              runtime.activeClip = clip;
              runtime.ambientAction = action;
              runtime.ambientClip = clip;
              runtime.nextAmbientAt =
                runtime.elapsed +
                nextAmbientDelay(emotionRef.current);
            }
          }
        }
        runtime.root.rotation.z = runtime.rootBaseRotation.z;
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
      controls.removeEventListener("start", markViewInteracted);
      controls.dispose();
      controlsRef.current = null;
      cameraRef.current = null;
      homeCameraRef.current = null;
      const runtime = runtimeRef.current;
      runtime?.mixer.stopAllAction();
      runtimeRef.current = null;
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
  }, [
    characterId,
    gazeRef,
    onError,
    onProgress,
    onReady,
  ]);

  return <div ref={containerRef} className="companion-3d-host" />;
}

function playClip(
  runtime: KayKitRuntime,
  clipName: string,
  action: ActionId,
  restart = true,
): void {
  const next = runtime.actions.get(clipName);
  if (!next) {
    return;
  }
  if (
    next === runtime.activeAction &&
    runtime.ambientAction === null &&
    !restart
  ) {
    return;
  }
  const shouldLoop =
    KAYKIT_COMPANION.loopClips.includes(
      clipName as (typeof KAYKIT_COMPANION.loopClips)[number],
    ) || (action === "DANCE" && clipName === "Cheering");
  runtime.activeAction?.fadeOut(0.24);
  if (restart) {
    next.reset();
  } else {
    next.enabled = true;
    next.paused = false;
  }
  next.setLoop(
    shouldLoop ? THREE.LoopRepeat : THREE.LoopOnce,
    shouldLoop ? Infinity : 1,
  );
  next.clampWhenFinished = !shouldLoop;
  const durationHint = actionDurationHints[action];
  const clipDurationMs = next.getClip().duration * 1000;
  next.setEffectiveTimeScale(
    !shouldLoop && durationHint
      ? THREE.MathUtils.clamp(
          clipDurationMs / durationHint,
          0.8,
          1.8,
        )
      : action === "IDLE"
        ? idleTimeScale(runtime, next)
        : 1,
  );
  next.setEffectiveWeight(1);
  next.fadeIn(0.24).play();
  runtime.activeAction = next;
  runtime.activeClip = clipName;
  runtime.host.dataset.activeClip = clipName;
  runtime.host.dataset.activeAction = action;
  if (action === "IDLE") {
    runtime.host.dataset.idleTransition = restart
      ? "fresh"
      : "resume";
  }
  if (action !== "IDLE") {
    runtime.ambientAction = null;
    runtime.ambientClip = null;
  }
}

function resolveIdleClip(
  emotion: Emotion,
  engagement: "IDLE" | "LISTENING" | "THINKING",
  availableClips: ReadonlySet<string>,
): string {
  if (engagement === "LISTENING" && availableClips.has("Idle_B")) {
    return "Idle_B";
  }
  if (engagement === "THINKING" && availableClips.has("Idle_A")) {
    return "Idle_A";
  }
  return resolveKayKitClip(emotion, availableClips);
}

function idleTimeScale(
  runtime: KayKitRuntime,
  action: THREE.AnimationAction,
): number {
  if (action.getClip().name === "Idle_B") {
    return 1.04;
  }
  return 1;
}

function ambientClipsForEmotion(emotion: Emotion): string[] {
  switch (emotion) {
    case "HAPPY":
      return ["Idle_B", "Waving", "Cheering"];
    case "SHY":
      return ["Idle_B", "Waving", "Interact"];
    case "SAD":
    case "SLEEPY":
      return ["Idle_B"];
    case "ANGRY":
      return ["Idle_B", "Interact"];
    default:
      return ["Idle_B", "Waving", "Interact"];
  }
}

function nextAmbientDelay(emotion: Emotion): number {
  const range =
    emotion === "SAD" || emotion === "SLEEPY"
      ? [16, 24]
      : emotion === "HAPPY" || emotion === "SHY"
        ? [6, 11]
        : [9, 16];
  return (
    range[0] +
    Math.random() * (range[1] - range[0])
  );
}
