import type { AntCaste } from "./types.js";

let antCounter = 0;

export function resetAntCounter(): void {
  antCounter = 0;
}

export function makeAntId(caste: AntCaste): string {
  return `${caste}-${++antCounter}-${Date.now().toString(36)}`;
}

export function makePheromoneId(): string {
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function makeTaskId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}
