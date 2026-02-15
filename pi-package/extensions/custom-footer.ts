/**
 * Custom Footer Extension — Enhanced status bar
 *
 * Displays: ↑input ↓output Rremaining $cost percent/contextWindow (auto) | ⏱ elapsed | 📂 cwd | 🌿 branch | model • thinking
 * Color-coded context usage: green <50%, yellow 50-75%, red >75%
 */

import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

export default function (pi: ExtensionAPI) {
	let sessionStart = Date.now();

	function formatElapsed(ms: number): string {
		const s = Math.floor(ms / 1000);
		if (s < 60) return `${s}s`;
		const m = Math.floor(s / 60);
		const rs = s % 60;
		if (m < 60) return `${m}m${rs > 0 ? rs + "s" : ""}`;
		const h = Math.floor(m / 60);
		const rm = m % 60;
		return `${h}h${rm > 0 ? rm + "m" : ""}`;
	}

	function fmt(n: number): string {
		if (n < 1000) return `${n}`;
		return `${(n / 1000).toFixed(1)}k`;
	}

	pi.on("session_start", async (_event, ctx) => {
		sessionStart = Date.now();

		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsub = footerData.onBranchChange(() => tui.requestRender());
			const timer = setInterval(() => tui.requestRender(), 30000);

			return {
				dispose() { unsub(); clearInterval(timer); },
				invalidate() {},
				render(width: number): string[] {
					// --- Tokens & Cost ---
					let input = 0, output = 0, cost = 0;
					for (const e of ctx.sessionManager.getBranch()) {
						if (e.type === "message" && e.message.role === "assistant") {
							const m = e.message as AssistantMessage;
							input += m.usage.input;
							output += m.usage.output;
							cost += m.usage.cost.total;
						}
					}

					// --- Context usage ---
					const usage = ctx.getContextUsage();
					const tokens = usage?.tokens ?? 0;
					const ctxWindow = usage?.contextWindow ?? 0;
					const pct = usage?.percent ?? 0;
					const remaining = Math.max(0, ctxWindow - tokens);

					// Color by usage level
					const pctColor = pct > 75 ? "error" : pct > 50 ? "warning" : "success";
					const pctStr = `${pct.toFixed(1)}%/${fmt(ctxWindow)}`;

					const tokenStats = [
						theme.fg("accent", `↑${fmt(input)}`),
						theme.fg("dim", ` ↓${fmt(output)}`),
						theme.fg("muted", ` R${fmt(remaining)}`),
						theme.fg("warning", ` $${cost.toFixed(3)}`),
						" ",
						theme.fg(pctColor, pctStr),
						theme.fg("dim", " (auto)"),
					].join("");

					// --- Elapsed ---
					const elapsed = theme.fg("dim", `⏱ ${formatElapsed(Date.now() - sessionStart)}`);

					// --- CWD (last 2 segments) ---
					const cwd = process.cwd();
					const parts = cwd.split("/");
					const short = parts.length > 2 ? parts.slice(-2).join("/") : cwd;
					const cwdStr = theme.fg("muted", `📂 ${short}`);

					// --- Git branch ---
					const branch = footerData.getGitBranch();
					const branchStr = branch ? theme.fg("accent", `🌿 ${branch}`) : "";

					// --- Right: model + thinking ---
					const thinking = pi.getThinkingLevel();
					const modelId = ctx.model?.id || "no-model";
					const right = theme.fg("dim", `${modelId} • ${thinking}`);

					// --- Layout ---
					const sep = theme.fg("dim", " │ ");
					const leftParts = [tokenStats, elapsed, cwdStr];
					if (branchStr) leftParts.push(branchStr);
					const left = leftParts.join(sep);

					const leftW = visibleWidth(left);
					const rightW = visibleWidth(right);
					const gap = width - leftW - rightW;
					if (gap >= 2) {
						const pad = " ".repeat(gap);
						return [truncateToWidth(left + pad + right, width)];
					}
					// Not enough space for right side — just show left truncated
					return [truncateToWidth(left, width)];
				},
			};
		});
	});

	pi.on("session_switch", async (event, _ctx) => {
		if (event.reason === "new") {
			sessionStart = Date.now();
		}
	});
}
