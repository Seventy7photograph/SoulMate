import { AnimatePresence, motion } from "framer-motion";
import type { Emotion } from "../domain/companionEngine";
import type {
  LightingPreset,
  SceneId,
} from "../domain/companionState";
import { SCENES } from "../domain/characterConfig";
import {
  clearWeather,
  type DayPhase,
  type WeatherSnapshot,
} from "../domain/environment";

interface SceneHabitatProps {
  sceneId: SceneId;
  emotion: Emotion;
  lighting: LightingPreset;
  reducedMotion: boolean;
  dayPhase?: DayPhase;
  weather?: WeatherSnapshot;
}

const sceneContent: Record<
  SceneId,
  {
    celestial: string;
    particles: number;
    foreground: string[];
    birds: number;
    butterflies: number;
    flowers: number;
    leaves: number;
    shells: number;
    shootingStars: number;
    sailboat: boolean;
  }
> = {
  BEACH: {
    celestial: "sun",
    particles: 8,
    foreground: ["wave", "wave", "wave", "sand"],
    birds: 4,
    butterflies: 0,
    flowers: 0,
    leaves: 0,
    shells: 5,
    shootingStars: 0,
    sailboat: true,
  },
  MEADOW: {
    celestial: "sun",
    particles: 12,
    foreground: ["hill", "hill", "grass", "grass", "grass"],
    birds: 3,
    butterflies: 5,
    flowers: 10,
    leaves: 0,
    shells: 0,
    shootingStars: 0,
    sailboat: false,
  },
  FOREST: {
    celestial: "moon",
    particles: 14,
    foreground: ["tree", "tree", "tree", "tree", "mist"],
    birds: 2,
    butterflies: 2,
    flowers: 4,
    leaves: 12,
    shells: 0,
    shootingStars: 0,
    sailboat: false,
  },
  SPACE: {
    celestial: "planet",
    particles: 24,
    foreground: ["planet", "orbit", "ridge"],
    birds: 0,
    butterflies: 0,
    flowers: 0,
    leaves: 0,
    shells: 0,
    shootingStars: 3,
    sailboat: false,
  },
};

export function SceneHabitat({
  sceneId,
  emotion,
  lighting,
  reducedMotion,
  dayPhase = "DAY",
  weather = clearWeather,
}: SceneHabitatProps) {
  const content = sceneContent[sceneId];

  return (
    <div
      className="scene-habitat"
      data-testid="scene-habitat"
      data-scene={sceneId}
      data-emotion={emotion}
      data-lighting={lighting}
      data-day-phase={dayPhase}
      data-weather={weather.kind}
      data-reduced-motion={reducedMotion}
      role="img"
      aria-label={`${SCENES[sceneId].label}动态场景`}
    >
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={sceneId}
          className={`scene-world scene-world--${sceneId.toLowerCase()}`}
          initial={reducedMotion ? false : { opacity: 0, scale: 1.025 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.72, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        >
          <div className="scene-sky" />
          <div className="scene-aurora" />
          <div className={`scene-celestial scene-celestial--${content.celestial}`} />
          <div className="scene-cloud-field">
            <span className="scene-cloud scene-cloud--one" />
            <span className="scene-cloud scene-cloud--two" />
            <span className="scene-cloud scene-cloud--three" />
          </div>
          <div className="scene-horizon" />
          <div className="scene-foreground">
            {content.foreground.map((shape, index) => (
              <span
                className={`scene-shape scene-shape--${shape}`}
                key={`${shape}-${index}`}
                style={{ "--shape-index": index } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="scene-life-layer">
            {Array.from({ length: content.birds }, (_, index) => (
              <span
                className="scene-bird"
                key={`bird-${index}`}
                style={
                  {
                    "--decor-index": index,
                    "--decor-delay": `${index * -2.7}s`,
                  } as React.CSSProperties
                }
              />
            ))}
            {Array.from(
              { length: content.butterflies },
              (_, index) => (
                <span
                  className="scene-butterfly"
                  key={`butterfly-${index}`}
                  style={
                    {
                      "--decor-index": index,
                      "--decor-delay": `${index * -1.4}s`,
                    } as React.CSSProperties
                  }
                />
              ),
            )}
            {Array.from({ length: content.flowers }, (_, index) => (
              <span
                className="scene-flower"
                key={`flower-${index}`}
                style={
                  {
                    "--decor-index": index,
                    "--decor-delay": `${index * -0.8}s`,
                  } as React.CSSProperties
                }
              />
            ))}
            {Array.from({ length: content.leaves }, (_, index) => (
              <span
                className="scene-leaf"
                key={`leaf-${index}`}
                style={
                  {
                    "--decor-index": index,
                    "--decor-delay": `${index * -1.2}s`,
                  } as React.CSSProperties
                }
              />
            ))}
            {Array.from({ length: content.shells }, (_, index) => (
              <span
                className="scene-shell"
                key={`shell-${index}`}
                style={
                  {
                    "--decor-index": index,
                  } as React.CSSProperties
                }
              />
            ))}
            {Array.from(
              { length: content.shootingStars },
              (_, index) => (
                <span
                  className="scene-shooting-star"
                  key={`shooting-${index}`}
                  style={
                    {
                      "--decor-index": index,
                      "--decor-delay": `${index * -3.2}s`,
                    } as React.CSSProperties
                  }
                />
              ),
            )}
            {content.sailboat ? (
              <span className="scene-sailboat" />
            ) : null}
          </div>
          <div className="scene-particle-field">
            {Array.from({ length: content.particles }, (_, index) => (
              <span
                className="scene-particle"
                key={index}
                style={
                  {
                    "--particle-index": index,
                    "--particle-x": `${(index * 37 + 11) % 100}%`,
                    "--particle-y": `${(index * 23 + 7) % 78}%`,
                    "--particle-delay": `${(index % 7) * -0.6}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="scene-daylight" aria-hidden="true" />
      <div className="scene-vignette" aria-hidden="true" />
      <div className="scene-grain" aria-hidden="true" />
    </div>
  );
}

export function WeatherLayer({
  weather,
  reducedMotion,
}: {
  weather: WeatherSnapshot;
  reducedMotion: boolean;
}) {
  const weatherParticles =
    weather.kind === "RAIN"
      ? 30
      : weather.kind === "SNOW"
        ? 24
        : weather.kind === "FOG"
          ? 6
          : 0;

  return (
    <div
      className="weather-layer"
      data-testid="weather-layer"
      data-weather={weather.kind}
      data-reduced-motion={reducedMotion}
      aria-hidden="true"
    >
      {Array.from({ length: weatherParticles }, (_, index) => (
        <span
          className={
            weather.kind === "FOG"
              ? "weather-fog"
              : weather.kind === "SNOW"
                ? "weather-snow"
                : "weather-rain"
          }
          key={`weather-${index}`}
          style={
            {
              "--weather-x": `${(index * 29 + 7) % 100}%`,
              "--weather-y": `${(index * 17 + 3) % 100}%`,
              "--weather-delay": `${(index % 9) * -0.36}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
