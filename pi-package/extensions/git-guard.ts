/**
 * oh-p! Git Checkpoint Extension
 *
 * Auto-stash before each turn, notify on agent completion.
 * Combines git-checkpoint + notify + dirty-repo-guard.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

function terminalNotify(title: string, body: string): void {
  if (process.env.KITTY_WINDOW_ID) {
    process.stdout.write(`\x1b]99;i=1:d=0;${title}\x1b\\`);
    process.stdout.write(`\x1b]99;i=1:p=body;${body}\x1b\\`);
  } else {
    process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
  }
}

export default function (pi: ExtensionAPI) {
  let turnCount = 0;

  // Warn on dirty repo at session start
  pi.on("session_start", async (_event, ctx) => {
    try {
      const { stdout } = await pi.exec("git", ["status", "--porcelain"]);
      if (stdout.trim() && ctx.hasUI) {
        const lines = stdout.trim().split("\n").length;
        ctx.ui.notify(`⚠️ Dirty repo: ${lines} uncommitted change(s)`, "warning");
      }
    } catch { /* not a git repo, ignore */ }
  });

  // Stash checkpoint before each turn
  pi.on("turn_start", async () => {
    turnCount++;
    try {
      await pi.exec("git", ["stash", "create", "-m", `oh-pi-turn-${turnCount}`]);
    } catch { /* not a git repo */ }
  });

  // Notify when agent is done
  pi.on("agent_end", async () => {
    terminalNotify("oh-p!", `Done after ${turnCount} turn(s). Ready for input.`);
    turnCount = 0;
  });
}
