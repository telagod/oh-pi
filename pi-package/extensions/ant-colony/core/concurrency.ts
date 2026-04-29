import * as os from "node:os";
import type { ConcurrencyConfig, ConcurrencySample } from "./types.js";

const CPU_CORES = os.cpus().length;

export function defaultConcurrency(): ConcurrencyConfig {
  return {
    current: 2,
    min: 1,
    max: Math.min(CPU_CORES, 8),
    optimal: 3,
    history: [],
  };
}

export function sampleSystem(activeTasks: number, completedRecently: number, windowMinutes: number): ConcurrencySample {
  const cpus = os.cpus();
  const cpuLoad = cpus.reduce((sum, c) => {
    const total = Object.values(c.times).reduce((a, b) => a + b, 0);
    return sum + 1 - c.times.idle / total;
  }, 0) / cpus.length;

  const mem = os.freemem();
  const throughput = windowMinutes > 0 ? completedRecently / windowMinutes : 0;

  return {
    timestamp: Date.now(),
    concurrency: activeTasks,
    cpuLoad,
    memFree: mem,
    throughput,
  };
}

export function adapt(config: ConcurrencyConfig, pendingTasks: number): ConcurrencyConfig {
  const next = { ...config };
  const samples = config.history;

  if (pendingTasks === 0) {
    next.current = config.min;
    return next;
  }

  const taskCap = Math.min(pendingTasks, config.max);

  if (samples.length < 2) {
    next.current = Math.min(Math.ceil(config.max / 2), taskCap);
    return next;
  }

  const latest = samples[samples.length - 1];
  const prev = samples[samples.length - 2];
  const recentCpuSamples = samples.slice(-3);
  const avgCpu = recentCpuSamples.reduce((s, x) => s + x.cpuLoad, 0) / recentCpuSamples.length;
  const inRateLimitCooldown = config.lastRateLimitAt != null && Date.now() - config.lastRateLimitAt < 30000;

  if (avgCpu > 0.85 || latest.memFree < 500 * 1024 * 1024) {
    next.current = Math.max(config.min, config.current - 1);
    return next;
  }

  const canIncrease = avgCpu < 0.6 && !inRateLimitCooldown;

  if (samples.length < 10) {
    if (latest.throughput >= prev.throughput && canIncrease) {
      next.current = Math.min(config.current + 1, taskCap);
    } else if (latest.throughput < prev.throughput) {
      next.optimal = prev.concurrency;
      next.current = prev.concurrency;
    }
    return next;
  }

  const recentThroughput = samples.slice(-5).reduce((s, x) => s + x.throughput, 0) / 5;
  const olderThroughput = samples.slice(-10, -5).reduce((s, x) => s + x.throughput, 0) / 5;

  if (recentThroughput > olderThroughput * 1.1 && canIncrease) {
    next.current = Math.min(config.current + 1, taskCap);
    if (recentThroughput > olderThroughput * 1.2) next.optimal = next.current;
  } else if (recentThroughput < olderThroughput * 0.8) {
    next.current = Math.max(config.min, config.optimal);
  }

  if (avgCpu < 0.5 && next.current < config.optimal && !inRateLimitCooldown) {
    next.current = config.optimal;
  }

  return next;
}
