/**
 * 自适应并发控制 — 模拟蚁群的动态招募机制
 *
 * 真实蚁群：食物多→释放更多招募信息素→更多工蚁出巢
 * 映射：任务多+系统空闲→提高并发；系统过载/任务少→降低并发
 *
 * 探索边界：启动时逐步提升并发，监测吞吐量拐点
 */

import * as os from "node:os";
import type { ConcurrencyConfig, ConcurrencySample } from "./types.js";

const CPU_CORES = os.cpus().length;

export function defaultConcurrency(): ConcurrencyConfig {
  return {
    current: 1,
    min: 1,
    max: Math.min(CPU_CORES, 8),
    optimal: 2,
    history: [],
  };
}

/** 采样当前系统负载 */
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

/**
 * 自适应调节算法
 *
 * 阶段1 - 探索期（样本<10）：每次+1，寻找吞吐量拐点
 * 阶段2 - 稳态期：围绕最优值微调
 *
 * 约束：
 * - CPU 负载 > 85% → 减少
 * - 可用内存 < 500MB → 减少
 * - 吞吐量下降 → 回退到上一个最优值
 * - 待处理任务为 0 → 降到 min
 */
export function adapt(config: ConcurrencyConfig, pendingTasks: number): ConcurrencyConfig {
  const next = { ...config };
  const samples = config.history;

  // 没有待处理任务，降到最低
  if (pendingTasks === 0) {
    next.current = config.min;
    return next;
  }

  // 不超过待处理任务数
  const taskCap = Math.min(pendingTasks, config.max);

  if (samples.length < 3) {
    // 冷启动：保守起步
    next.current = Math.min(2, taskCap);
    return next;
  }

  const latest = samples[samples.length - 1];
  const prev = samples[samples.length - 2];

  // 硬约束：系统过载立即减少
  if (latest.cpuLoad > 0.85 || latest.memFree < 500 * 1024 * 1024) {
    next.current = Math.max(config.min, config.current - 1);
    return next;
  }

  // 探索期：样本不足，逐步提升
  if (samples.length < 10) {
    if (latest.throughput >= prev.throughput) {
      // 吞吐量还在涨，继续探索
      next.current = Math.min(config.current + 1, taskCap);
    } else {
      // 吞吐量下降，找到拐点
      next.optimal = prev.concurrency;
      next.current = prev.concurrency;
    }
    return next;
  }

  // 稳态期：围绕最优值微调
  const recentThroughput = samples.slice(-5).reduce((s, x) => s + x.throughput, 0) / 5;
  const olderThroughput = samples.slice(-10, -5).reduce((s, x) => s + x.throughput, 0) / 5;

  if (recentThroughput > olderThroughput * 1.1 && latest.cpuLoad < 0.7) {
    // 吞吐量上升且 CPU 有余量，尝试+1
    next.current = Math.min(config.current + 1, taskCap);
    if (recentThroughput > olderThroughput * 1.2) {
      next.optimal = next.current; // 更新最优值
    }
  } else if (recentThroughput < olderThroughput * 0.8) {
    // 吞吐量下降，回退
    next.current = Math.max(config.min, config.optimal);
  }
  // 否则保持不变

  return next;
}
