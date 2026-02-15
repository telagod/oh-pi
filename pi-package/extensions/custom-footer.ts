/**
 * Custom Footer Extension — Enhanced status bar
 *
 * Displays: in/out/remaining tokens, cost, context%, elapsed, cwd, git branch, model
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
					let input = 0, output = 0, cost = 0;
					for (const e of ctx.sessionManager.getBranch()) {
						if (e.type === "message" && e.message.role === "assistant") {
							const m = e.message as AssistantMessage;
							input += m.usage.input;
							output += m.usage.output;
							cost += m.usage.cost.total;
						}
					}

					const usage = ctx.getContextUsage();
					const ctxWindow = usage?.contextWindow ?? 0;
					const pct = usage?.percent ?? 0;
					const remaining = Math.max(0, ctxWindow - (usage?.tokens ?? 0));

					const pctColor = pct > 75 ? "error" : pct > 50 ? "warning" : "success";

					const tokenStats = [
						theme.fg("accent", `${fmt(input)}/${fmt(output)}`),
						theme.fg("warning", `$${cost.toFixed(2)}`),
						theme.fg(pctColor, `${pct.toFixed(0)}%`),
					].join(" ");

					const elapsed = theme.fg("dim", `⏱${formatElapsed(Date.now() - sessionStart)}`);

					const parts = process.cwd().split("/");
					const short = parts.length > 2 ? parts.slice(-2).join("/") : process.cwd();
					const cwdStr = theme.fg("muted", `⌂ ${short}`);

					const branch = footerData.getGitBranch();
					const branchStr = branch ? theme.fg("accent", `⎇ ${branch}`) : "";

					const thinking = pi.getThinkingLevel();
					const modelId = ctx.model?.id || "no-model";
					const modelStr = theme.fg("accent", `◆ ${modelId}`);

					const sep = theme.fg("dim", " | ");
					const leftParts = [modelStr, tokenStats, elapsed, cwdStr];
					if (branchStr) leftParts.push(branchStr);
					const left = leftParts.join(sep);

					const right = theme.fg("dim", thinking);

					const leftW = visibleWidth(left);
					const rightW = visibleWidth(right);
					const gap = width - leftW - rightW;
					if (gap >= 2) {
						return [truncateToWidth(left + " ".repeat(gap) + right, width)];
					}
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
