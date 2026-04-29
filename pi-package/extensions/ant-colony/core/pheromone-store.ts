import * as fs from "node:fs";
import type { Pheromone } from "./types.js";

export interface PheromoneStore {
  append(entry: Pheromone): void;
  listActive(now?: number): Pheromone[];
  compact?(now?: number): void;
  close?(): void;
}

export interface JsonlPheromoneStoreOptions {
  halfLifeMs?: number;
  minStrength?: number;
  compactEvery?: number;
}

export class JsonlPheromoneStore implements PheromoneStore {
  private readonly halfLifeMs: number;
  private readonly minStrength: number;
  private readonly compactEvery: number;
  private cache: Pheromone[] = [];
  private offset = 0;
  private gcCounter = 0;

  constructor(
    private readonly file: string,
    options: JsonlPheromoneStoreOptions = {},
  ) {
    this.halfLifeMs = options.halfLifeMs ?? 10 * 60 * 1000;
    this.minStrength = options.minStrength ?? 0.05;
    this.compactEvery = options.compactEvery ?? 10;
  }

  append(entry: Pheromone): void {
    fs.appendFileSync(this.file, JSON.stringify(entry) + "\n");
  }

  listActive(now = Date.now()): Pheromone[] {
    if (!fs.existsSync(this.file)) return this.cache;

    const stat = fs.statSync(this.file);
    if (stat.size > this.offset) {
      const fd = fs.openSync(this.file, "r");
      try {
        const buf = Buffer.alloc(stat.size - this.offset);
        fs.readSync(fd, buf, 0, buf.length, this.offset);
        const newLines = buf.toString("utf-8").split("\n").filter(Boolean);
        for (const line of newLines) {
          this.cache.push(JSON.parse(line) as Pheromone);
        }
        this.offset = stat.size;
      } finally {
        fs.closeSync(fd);
      }
    }

    const beforeLen = this.cache.length;
    this.cache = this.cache.filter((p) => {
      p.strength = Math.pow(0.5, (now - p.createdAt) / this.halfLifeMs);
      return p.strength > this.minStrength;
    });

    const hadGarbage = this.cache.length < beforeLen;
    this.gcCounter++;
    if (this.gcCounter >= this.compactEvery && hadGarbage) {
      this.compact(now);
      this.gcCounter = 0;
    }

    return this.cache;
  }

  compact(): void {
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, this.cache.map((p) => JSON.stringify(p)).join("\n") + (this.cache.length ? "\n" : ""));
    fs.renameSync(tmp, this.file);
    this.offset = fs.existsSync(this.file) ? fs.statSync(this.file).size : 0;
  }

  close(): void {
    // no-op for local JSONL store
  }
}
