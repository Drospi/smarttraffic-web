export type CanonicalSpriteKey =
  | 'road_tile'
  | 'car_cyan'
  | 'car_yellow'
  | 'car_pink'
  | 'traffic_light';

export type ExtendedSpriteKey =
  | CanonicalSpriteKey
  | 'road_intersection'
  | 'light_red'
  | 'light_yellow'
  | 'light_green';

export interface SpriteStatusEntry {
  key: CanonicalSpriteKey;
  recommendedFile: string;
  recommendedSize: string;
  description: string;
  matchedFile: string | null;
  loaded: boolean;
}

const spriteModules = import.meta.glob('../assets/sprites/*.{png,svg,webp}', {
  eager: true,
  import: 'default',
}) as Record<string, string>;

const CANONICAL_SPECS: readonly {
  key: CanonicalSpriteKey;
  recommendedFile: string;
  recommendedSize: string;
  description: string;
  aliases: readonly string[];
}[] = [
  {
    key: 'road_tile',
    recommendedFile: 'road_tile.png',
    recommendedSize: '32x32 o 64x64 px',
    description: 'Baldosa de asfalto / calle pixel-art con líneas viales',
    aliases: ['road_tile', 'calle'],
  },
  {
    key: 'car_cyan',
    recommendedFile: 'car_cyan.png',
    recommendedSize: '32x32 o 64x64 px',
    description: 'Auto vista superior (orientado a la derecha, tono cian/azul)',
    aliases: ['car_cyan', 'auto 2'],
  },
  {
    key: 'car_yellow',
    recommendedFile: 'car_yellow.png',
    recommendedSize: '32x32 o 64x64 px',
    description: 'Auto vista superior (orientado a la derecha, tono ámbar/verde)',
    aliases: ['car_yellow', 'auto 3'],
  },
  {
    key: 'car_pink',
    recommendedFile: 'car_pink.png',
    recommendedSize: '32x32 o 64x64 px',
    description: 'Auto vista superior (orientado a la derecha, tono rosa/rojo)',
    aliases: ['car_pink', 'auto 1'],
  },
  {
    key: 'traffic_light',
    recommendedFile: 'traffic_light.png',
    recommendedSize: '32x32 o 64x64 px',
    description: 'Semáforo pixel-art para las intersecciones I1 e I2',
    aliases: ['traffic_light', 'semaforo'],
  },
] as const;

const EXTENDED_ALIASES: Record<Exclude<ExtendedSpriteKey, CanonicalSpriteKey>, readonly string[]> = {
  road_intersection: ['road_intersection', 'calle interseccion'],
  light_red: ['light_red', 'luz roja'],
  light_yellow: ['light_yellow', 'luz amarilla'],
  light_green: ['light_green', 'luz verde'],
};

interface LoadedSpriteEntry {
  filename: string;
  url: string;
  image: HTMLImageElement | null;
  loaded: boolean;
}

class SpriteManager {
  private readonly rawFiles: Map<string, { filename: string; url: string }> = new Map();
  private readonly sprites: Map<ExtendedSpriteKey, LoadedSpriteEntry> = new Map();

  constructor() {
    for (const [path, url] of Object.entries(spriteModules)) {
      const filename = path.split('/').pop() ?? path;
      const baseName = filename.replace(/\.[^.]+$/, '').toLowerCase();
      this.rawFiles.set(baseName, { filename, url });
    }

    for (const spec of CANONICAL_SPECS) {
      this.registerSprite(spec.key, spec.aliases);
    }

    (Object.keys(EXTENDED_ALIASES) as Array<Exclude<ExtendedSpriteKey, CanonicalSpriteKey>>).forEach(
      (key) => {
        this.registerSprite(key, EXTENDED_ALIASES[key]);
      }
    );
  }

  private registerSprite(key: ExtendedSpriteKey, aliases: readonly string[]): void {
    for (const alias of aliases) {
      const match = this.rawFiles.get(alias.toLowerCase());
      if (match) {
        const entry: LoadedSpriteEntry = {
          filename: match.filename,
          url: match.url,
          image: null,
          loaded: false,
        };
        if (typeof Image !== 'undefined') {
          const img = new Image();
          img.decoding = 'async';
          img.onload = () => {
            entry.loaded = true;
          };
          img.onerror = () => {
            entry.loaded = false;
            entry.image = null;
          };
          img.src = match.url;
          entry.image = img;
        }
        this.sprites.set(key, entry);
        return;
      }
    }
  }

  public getImage(key: ExtendedSpriteKey): HTMLImageElement | null {
    const entry = this.sprites.get(key);
    if (!entry || !entry.loaded || !entry.image) return null;
    return entry.image;
  }

  public hasAnySpriteLoaded(): boolean {
    for (const entry of this.sprites.values()) {
      if (entry.loaded && entry.image) return true;
    }
    return false;
  }

  public getDetectedFilenames(): string[] {
    return Array.from(this.rawFiles.values())
      .map((item) => item.filename)
      .sort((a, b) => a.localeCompare(b));
  }

  public getCanonicalStatus(): SpriteStatusEntry[] {
    return CANONICAL_SPECS.map((spec) => {
      const entry = this.sprites.get(spec.key);
      return {
        key: spec.key,
        recommendedFile: spec.recommendedFile,
        recommendedSize: spec.recommendedSize,
        description: spec.description,
        matchedFile: entry?.filename ?? null,
        loaded: Boolean(entry?.loaded),
      };
    });
  }
}

export const spriteManager = new SpriteManager();
