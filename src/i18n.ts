import * as p from "@clack/prompts";
import { execSync } from "node:child_process";

export type Locale = "en" | "zh" | "fr";

let current: Locale = "en";

const messages: Record<Locale, Record<string, string>> = {
  en: {
    // welcome
    "welcome.title": "oh-pi — one-click setup for pi agent",
    "welcome.piDetected": "pi {version} detected",
    "welcome.piNotFound": "pi not found — will install",
    "welcome.envInfo": "{terminal} │ {os} │ Node {node}",
    "welcome.existingConfig": "Existing config found",
    "welcome.existingConfigDetail": "{count} files ({size}KB) at ~/.pi/agent/",
    "welcome.existingProviders": "Detected providers: {providers}",

    // language
    "lang.select": "Language / 语言 / Langue:",

    // mode
    "mode.select": "How would you like to set up pi?",
    "mode.quick": "🚀 Quick Setup",
    "mode.quickHint": "Recommended defaults, 3 steps",
    "mode.preset": "📦 Preset",
    "mode.presetHint": "Choose a pre-made configuration",
    "mode.custom": "🎛️  Custom",
    "mode.customHint": "Pick everything yourself",

    // provider
    "provider.select": "Select API providers",
    "provider.custom": "🔧 Custom endpoint",
    "provider.customHint": "Ollama, vLLM, LiteLLM, any OpenAI-compatible",
    "provider.foundEnv": "Found {env} in environment. Use it?",
    "provider.customEndpoint": "Custom endpoint for {label}? (proxy, Azure, etc.)",
    "provider.baseUrl": "Base URL for {label}:",
    "provider.baseUrlPlaceholder": "https://your-proxy.example.com",
    "provider.baseUrlValidation": "Must be a valid URL",
    "provider.configured": "{label} configured",
    "provider.name": "Provider name:",
    "provider.namePlaceholder": "ollama",
    "provider.nameRequired": "Name required",
    "provider.baseUrlCustom": "Base URL:",
    "provider.baseUrlCustomPlaceholder": "http://localhost:11434",
    "provider.needsKey": "Requires API key?",
    "provider.apiKey": "API key for {label}:",
    "provider.apiKeyRequired": "API key cannot be empty",
    "provider.fetchingModels": "Fetching models from {source}",
    "provider.foundModels": "Found {count} models",
    "provider.noModels": "No models found via API",
    "provider.defaultModelList": "Using default model list",
    "provider.selectModel": "Default model for {label}:",
    "provider.modelName": "Model name for {label}:",
    "provider.modelNamePlaceholder": "llama3.1:8b",
    "provider.modelNameRequired": "Model name required",
    "provider.customConfigured": "{name} configured ({url})",
    "provider.configureCaps": "Configure model capabilities? (context window, multimodal, reasoning)",
    "provider.contextWindow": "Context window size (tokens):",
    "provider.contextWindowValidation": "Must be a number ≥ 1024",
    "provider.maxTokens": "Max output tokens:",
    "provider.maxTokensValidation": "Must be a number ≥ 256",
    "provider.multimodal": "Supports image input (multimodal)?",
    "provider.reasoning": "Supports extended thinking (reasoning)?",
    "provider.detected": "Existing providers detected: {list}",
    "provider.detectedSkip": "⏭  Skip — keep existing",
    "provider.detectedSkipHint": "Don't change provider config",
    "provider.detectedAdd": "➕ Add new providers",
    "provider.detectedAddHint": "Configure additional providers",

    // preset
    "preset.select": "Choose a preset:",
    "preset.starter": "🟢 Starter",
    "preset.starterHint": "New to AI coding? Start here",
    "preset.pro": "🔵 Pro Developer",
    "preset.proHint": "Full-stack dev with all the bells and whistles",
    "preset.security": "🟣 Security Researcher",
    "preset.securityHint": "Pentesting, auditing, vulnerability research",
    "preset.dataai": "🟠 Data & AI Engineer",
    "preset.dataaiHint": "MLOps, data pipelines, AI applications",
    "preset.minimal": "🔴 Minimal",
    "preset.minimalHint": "Just the core, nothing extra",
    "preset.full": "⚫ Full Power",
    "preset.fullHint": "Everything installed, ant colony included",

    // theme
    "theme.select": "Choose a theme:",

    // keybindings
    "kb.select": "Keybinding scheme:",
    "kb.default": "⌨️  Default",
    "kb.defaultHint": "Pi standard keybindings",
    "kb.vim": "🟢 Vim",
    "kb.vimHint": "Alt+hjkl navigation",
    "kb.emacs": "🔵 Emacs",
    "kb.emacsHint": "Ctrl+pnbf navigation",

    // extensions
    "ext.select": "Select extensions:",

    // agents
    "agent.select": "AGENTS.md template:",
    "agent.general": "📋 General Developer",
    "agent.generalHint": "Universal coding guidelines",
    "agent.fullstack": "🏗️  Full-Stack Developer",
    "agent.fullstackHint": "Frontend + Backend + DB",
    "agent.security": "🔒 Security Researcher",
    "agent.securityHint": "Pentesting & audit",
    "agent.dataai": "🤖 Data & AI Engineer",
    "agent.dataaiHint": "MLOps & pipelines",
    "agent.colony": "🐜 Colony Operator",
    "agent.colonyHint": "Ant swarm multi-agent",

    // advanced
    "advanced.configure": "Configure advanced settings? (compaction threshold, etc.)",
    "advanced.compactThreshold": "Auto-compact when context reaches % of window (0-100):",
    "advanced.compactValidation": "Must be a number between 10 and 100",

    // confirm
    "confirm.title": "Configuration",
    "confirm.providers": "Providers:",
    "confirm.model": "Model:",
    "confirm.theme": "Theme:",
    "confirm.keybindings": "Keybindings:",
    "confirm.thinking": "Thinking:",
    "confirm.compaction": "Compaction:",
    "confirm.compactionValue": "{pct}% of context",
    "confirm.extensions": "Extensions:",
    "confirm.skills": "Skills:",
    "confirm.prompts": "Prompts:",
    "confirm.promptsValue": "{count} templates",
    "confirm.agents": "AGENTS.md:",
    "confirm.none": "none",
    "confirm.skipped": "(kept existing)",
    "confirm.changes": "⚠ Changes",
    "confirm.existingDetected": "Existing config detected. How to proceed?",
    "confirm.backup": "📦 Backup & apply",
    "confirm.backupHint": "Safe — backup first, then overwrite",
    "confirm.overwrite": "⚡ Overwrite",
    "confirm.overwriteHint": "Replace without backup",
    "confirm.cancel": "✖  Cancel",
    "confirm.cancelHint": "Keep current config",
    "confirm.noChanges": "No changes made.",
    "confirm.backingUp": "Backing up ~/.pi/agent/",
    "confirm.backedUp": "Backed up to {dir}",
    "confirm.apply": "Apply configuration?",
    "confirm.installingPi": "Installing pi-coding-agent",
    "confirm.piInstalled": "pi installed",
    "confirm.piFailed": "Failed: {error}",
    "confirm.piManual": "Run manually: npm install -g @mariozechner/pi-coding-agent",
    "confirm.writing": "Writing configuration",
    "confirm.applied": "Configuration applied",
    "confirm.installed": "✓ Installed",
    "confirm.run": "Run {cmd} to start coding!",

    // common
    "cancelled": "Cancelled.",
    "default": "default",
  },

  zh: {
    "welcome.title": "oh-pi — pi agent 一键配置",
    "welcome.piDetected": "检测到 pi {version}",
    "welcome.piNotFound": "未找到 pi — 将自动安装",
    "welcome.envInfo": "{terminal} │ {os} │ Node {node}",
    "welcome.existingConfig": "发现已有配置",
    "welcome.existingConfigDetail": "~/.pi/agent/ 下有 {count} 个文件 ({size}KB)",
    "welcome.existingProviders": "检测到已有 Provider: {providers}",

    "lang.select": "Language / 语言 / Langue:",

    "mode.select": "选择配置方式：",
    "mode.quick": "🚀 快速配置",
    "mode.quickHint": "推荐默认值，3 步完成",
    "mode.preset": "📦 预设方案",
    "mode.presetHint": "选择预制配置",
    "mode.custom": "🎛️  自定义",
    "mode.customHint": "逐项自选",

    "provider.select": "选择 API 提供商",
    "provider.custom": "🔧 自定义端点",
    "provider.customHint": "Ollama、vLLM、LiteLLM 等 OpenAI 兼容接口",
    "provider.foundEnv": "在环境变量中找到 {env}，是否使用？",
    "provider.customEndpoint": "为 {label} 设置自定义端点？（代理、Azure 等）",
    "provider.baseUrl": "{label} 的 Base URL：",
    "provider.baseUrlPlaceholder": "https://your-proxy.example.com",
    "provider.baseUrlValidation": "必须是有效的 URL",
    "provider.configured": "{label} 配置完成",
    "provider.name": "提供商名称：",
    "provider.namePlaceholder": "ollama",
    "provider.nameRequired": "名称不能为空",
    "provider.baseUrlCustom": "Base URL：",
    "provider.baseUrlCustomPlaceholder": "http://localhost:11434",
    "provider.needsKey": "需要 API 密钥？",
    "provider.apiKey": "{label} 的 API 密钥：",
    "provider.apiKeyRequired": "API 密钥不能为空",
    "provider.fetchingModels": "正在从 {source} 获取模型列表",
    "provider.foundModels": "找到 {count} 个模型",
    "provider.noModels": "未通过 API 找到模型",
    "provider.defaultModelList": "使用默认模型列表",
    "provider.selectModel": "{label} 的默认模型：",
    "provider.modelName": "{label} 的模型名称：",
    "provider.modelNamePlaceholder": "llama3.1:8b",
    "provider.modelNameRequired": "模型名称不能为空",
    "provider.customConfigured": "{name} 配置完成 ({url})",
    "provider.configureCaps": "配置模型能力？（上下文窗口、多模态、推理）",
    "provider.contextWindow": "上下文窗口大小（tokens）：",
    "provider.contextWindowValidation": "必须是 ≥ 1024 的数字",
    "provider.maxTokens": "最大输出 tokens：",
    "provider.maxTokensValidation": "必须是 ≥ 256 的数字",
    "provider.multimodal": "支持图片输入（多模态）？",
    "provider.reasoning": "支持扩展思考（推理）？",
    "provider.detected": "检测到已有 Provider: {list}",
    "provider.detectedSkip": "⏭  跳过 — 保留现有配置",
    "provider.detectedSkipHint": "不修改 Provider 配置",
    "provider.detectedAdd": "➕ 添加新 Provider",
    "provider.detectedAddHint": "配置额外的 Provider",

    "preset.select": "选择预设方案：",
    "preset.starter": "🟢 入门",
    "preset.starterHint": "AI 编程新手？从这里开始",
    "preset.pro": "🔵 专业开发者",
    "preset.proHint": "全栈开发，功能齐全",
    "preset.security": "🟣 安全研究员",
    "preset.securityHint": "渗透测试、审计、漏洞研究",
    "preset.dataai": "🟠 数据与 AI 工程师",
    "preset.dataaiHint": "MLOps、数据管道、AI 应用",
    "preset.minimal": "🔴 极简",
    "preset.minimalHint": "仅核心功能",
    "preset.full": "⚫ 全功能",
    "preset.fullHint": "全部安装，含蚁群模式",

    "theme.select": "选择主题：",

    "kb.select": "快捷键方案：",
    "kb.default": "⌨️  默认",
    "kb.defaultHint": "Pi 标准快捷键",
    "kb.vim": "🟢 Vim",
    "kb.vimHint": "Alt+hjkl 导航",
    "kb.emacs": "🔵 Emacs",
    "kb.emacsHint": "Ctrl+pnbf 导航",

    "ext.select": "选择扩展：",

    "agent.select": "AGENTS.md 模板：",
    "agent.general": "📋 通用开发者",
    "agent.generalHint": "通用编码指南",
    "agent.fullstack": "🏗️  全栈开发者",
    "agent.fullstackHint": "前端 + 后端 + 数据库",
    "agent.security": "🔒 安全研究员",
    "agent.securityHint": "渗透测试与审计",
    "agent.dataai": "🤖 数据与 AI 工程师",
    "agent.dataaiHint": "MLOps 与数据管道",
    "agent.colony": "🐜 蚁群指挥官",
    "agent.colonyHint": "蚁群多 Agent 协同",

    "advanced.configure": "配置高级选项？（压缩阈值等）",
    "advanced.compactThreshold": "上下文达到窗口的百分之几时自动压缩 (10-100)：",
    "advanced.compactValidation": "必须是 10 到 100 之间的数字",

    "confirm.title": "配置摘要",
    "confirm.providers": "提供商：",
    "confirm.model": "模型：",
    "confirm.theme": "主题：",
    "confirm.keybindings": "快捷键：",
    "confirm.thinking": "思考：",
    "confirm.compaction": "压缩：",
    "confirm.compactionValue": "上下文的 {pct}%",
    "confirm.extensions": "扩展：",
    "confirm.skills": "技能：",
    "confirm.prompts": "模板：",
    "confirm.promptsValue": "{count} 个模板",
    "confirm.agents": "AGENTS.md：",
    "confirm.none": "无",
    "confirm.skipped": "（保留现有）",
    "confirm.changes": "⚠ 变更",
    "confirm.existingDetected": "检测到已有配置，如何处理？",
    "confirm.backup": "📦 备份后应用",
    "confirm.backupHint": "安全 — 先备份再覆盖",
    "confirm.overwrite": "⚡ 直接覆盖",
    "confirm.overwriteHint": "不备份直接替换",
    "confirm.cancel": "✖  取消",
    "confirm.cancelHint": "保留当前配置",
    "confirm.noChanges": "未做任何更改。",
    "confirm.backingUp": "正在备份 ~/.pi/agent/",
    "confirm.backedUp": "已备份到 {dir}",
    "confirm.apply": "应用配置？",
    "confirm.installingPi": "正在安装 pi-coding-agent",
    "confirm.piInstalled": "pi 安装完成",
    "confirm.piFailed": "失败：{error}",
    "confirm.piManual": "请手动运行：npm install -g @mariozechner/pi-coding-agent",
    "confirm.writing": "正在写入配置",
    "confirm.applied": "配置已应用",
    "confirm.installed": "✓ 已安装",
    "confirm.run": "运行 {cmd} 开始编码！",

    "cancelled": "已取消。",
    "default": "默认",
  },

  fr: {
    "welcome.title": "oh-pi — configuration en un clic pour pi agent",
    "welcome.piDetected": "pi {version} détecté",
    "welcome.piNotFound": "pi non trouvé — installation en cours",
    "welcome.envInfo": "{terminal} │ {os} │ Node {node}",
    "welcome.existingConfig": "Configuration existante trouvée",
    "welcome.existingConfigDetail": "{count} fichiers ({size}Ko) dans ~/.pi/agent/",
    "welcome.existingProviders": "Fournisseurs détectés : {providers}",

    "lang.select": "Language / 语言 / Langue :",

    "mode.select": "Comment souhaitez-vous configurer pi ?",
    "mode.quick": "🚀 Configuration rapide",
    "mode.quickHint": "Valeurs par défaut recommandées, 3 étapes",
    "mode.preset": "📦 Préréglage",
    "mode.presetHint": "Choisir une configuration prédéfinie",
    "mode.custom": "🎛️  Personnalisé",
    "mode.customHint": "Tout choisir soi-même",

    "provider.select": "Sélectionner les fournisseurs API",
    "provider.custom": "🔧 Point d'accès personnalisé",
    "provider.customHint": "Ollama, vLLM, LiteLLM, tout compatible OpenAI",
    "provider.foundEnv": "{env} trouvé dans l'environnement. L'utiliser ?",
    "provider.customEndpoint": "Point d'accès personnalisé pour {label} ? (proxy, Azure, etc.)",
    "provider.baseUrl": "URL de base pour {label} :",
    "provider.baseUrlPlaceholder": "https://your-proxy.example.com",
    "provider.baseUrlValidation": "Doit être une URL valide",
    "provider.configured": "{label} configuré",
    "provider.name": "Nom du fournisseur :",
    "provider.namePlaceholder": "ollama",
    "provider.nameRequired": "Nom requis",
    "provider.baseUrlCustom": "URL de base :",
    "provider.baseUrlCustomPlaceholder": "http://localhost:11434",
    "provider.needsKey": "Nécessite une clé API ?",
    "provider.apiKey": "Clé API pour {label} :",
    "provider.apiKeyRequired": "La clé API ne peut pas être vide",
    "provider.fetchingModels": "Récupération des modèles depuis {source}",
    "provider.foundModels": "{count} modèles trouvés",
    "provider.noModels": "Aucun modèle trouvé via l'API",
    "provider.defaultModelList": "Utilisation de la liste de modèles par défaut",
    "provider.selectModel": "Modèle par défaut pour {label} :",
    "provider.modelName": "Nom du modèle pour {label} :",
    "provider.modelNamePlaceholder": "llama3.1:8b",
    "provider.modelNameRequired": "Nom du modèle requis",
    "provider.customConfigured": "{name} configuré ({url})",
    "provider.configureCaps": "Configurer les capacités du modèle ? (fenêtre de contexte, multimodal, raisonnement)",
    "provider.contextWindow": "Taille de la fenêtre de contexte (tokens) :",
    "provider.contextWindowValidation": "Doit être un nombre ≥ 1024",
    "provider.maxTokens": "Tokens de sortie maximum :",
    "provider.maxTokensValidation": "Doit être un nombre ≥ 256",
    "provider.multimodal": "Prend en charge l'entrée d'images (multimodal) ?",
    "provider.reasoning": "Prend en charge la réflexion étendue (raisonnement) ?",
    "provider.detected": "Fournisseurs existants détectés : {list}",
    "provider.detectedSkip": "⏭  Passer — garder l'existant",
    "provider.detectedSkipHint": "Ne pas modifier la config des fournisseurs",
    "provider.detectedAdd": "➕ Ajouter de nouveaux fournisseurs",
    "provider.detectedAddHint": "Configurer des fournisseurs supplémentaires",

    "preset.select": "Choisir un préréglage :",
    "preset.starter": "🟢 Débutant",
    "preset.starterHint": "Nouveau en codage IA ? Commencez ici",
    "preset.pro": "🔵 Développeur Pro",
    "preset.proHint": "Full-stack avec toutes les options",
    "preset.security": "🟣 Chercheur en sécurité",
    "preset.securityHint": "Pentest, audit, recherche de vulnérabilités",
    "preset.dataai": "🟠 Ingénieur Data & IA",
    "preset.dataaiHint": "MLOps, pipelines de données, applications IA",
    "preset.minimal": "🔴 Minimal",
    "preset.minimalHint": "Juste l'essentiel",
    "preset.full": "⚫ Pleine puissance",
    "preset.fullHint": "Tout installé, colonie de fourmis incluse",

    "theme.select": "Choisir un thème :",

    "kb.select": "Schéma de raccourcis :",
    "kb.default": "⌨️  Par défaut",
    "kb.defaultHint": "Raccourcis standard Pi",
    "kb.vim": "🟢 Vim",
    "kb.vimHint": "Navigation Alt+hjkl",
    "kb.emacs": "🔵 Emacs",
    "kb.emacsHint": "Navigation Ctrl+pnbf",

    "ext.select": "Sélectionner les extensions :",

    "agent.select": "Modèle AGENTS.md :",
    "agent.general": "📋 Développeur général",
    "agent.generalHint": "Directives de codage universelles",
    "agent.fullstack": "🏗️  Développeur Full-Stack",
    "agent.fullstackHint": "Frontend + Backend + BDD",
    "agent.security": "🔒 Chercheur en sécurité",
    "agent.securityHint": "Pentest & audit",
    "agent.dataai": "🤖 Ingénieur Data & IA",
    "agent.dataaiHint": "MLOps & pipelines",
    "agent.colony": "🐜 Opérateur de colonie",
    "agent.colonyHint": "Essaim multi-agent",

    "advanced.configure": "Configurer les paramètres avancés ? (seuil de compaction, etc.)",
    "advanced.compactThreshold": "Compacter automatiquement quand le contexte atteint % de la fenêtre (10-100) :",
    "advanced.compactValidation": "Doit être un nombre entre 10 et 100",

    "confirm.title": "Configuration",
    "confirm.providers": "Fournisseurs :",
    "confirm.model": "Modèle :",
    "confirm.theme": "Thème :",
    "confirm.keybindings": "Raccourcis :",
    "confirm.thinking": "Réflexion :",
    "confirm.compaction": "Compaction :",
    "confirm.compactionValue": "{pct}% du contexte",
    "confirm.extensions": "Extensions :",
    "confirm.skills": "Compétences :",
    "confirm.prompts": "Modèles :",
    "confirm.promptsValue": "{count} modèles",
    "confirm.agents": "AGENTS.md :",
    "confirm.none": "aucun",
    "confirm.skipped": "(existant conservé)",
    "confirm.changes": "⚠ Modifications",
    "confirm.existingDetected": "Configuration existante détectée. Comment procéder ?",
    "confirm.backup": "📦 Sauvegarder & appliquer",
    "confirm.backupHint": "Sûr — sauvegarde d'abord, puis écrasement",
    "confirm.overwrite": "⚡ Écraser",
    "confirm.overwriteHint": "Remplacer sans sauvegarde",
    "confirm.cancel": "✖  Annuler",
    "confirm.cancelHint": "Garder la configuration actuelle",
    "confirm.noChanges": "Aucune modification effectuée.",
    "confirm.backingUp": "Sauvegarde de ~/.pi/agent/",
    "confirm.backedUp": "Sauvegardé dans {dir}",
    "confirm.apply": "Appliquer la configuration ?",
    "confirm.installingPi": "Installation de pi-coding-agent",
    "confirm.piInstalled": "pi installé",
    "confirm.piFailed": "Échec : {error}",
    "confirm.piManual": "Exécutez manuellement : npm install -g @mariozechner/pi-coding-agent",
    "confirm.writing": "Écriture de la configuration",
    "confirm.applied": "Configuration appliquée",
    "confirm.installed": "✓ Installé",
    "confirm.run": "Exécutez {cmd} pour commencer à coder !",

    "cancelled": "Annulé.",
    "default": "par défaut",
  },
};

/**
 * 根据当前语言环境获取翻译文本，支持变量插值。
 * @param key - 翻译键名
 * @param vars - 可选的插值变量，用于替换文本中的 `{key}` 占位符
 * @returns 翻译后的字符串，若未找到则返回原始 key
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  let text = messages[current]?.[key] ?? messages.en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

/**
 * 设置当前语言环境。
 * @param locale - 目标语言代码
 */
export function setLocale(locale: Locale) { current = locale; }

/**
 * 获取当前语言环境。
 * @returns 当前的语言代码
 */
export function getLocale(): Locale { return current; }

/**
 * 从环境变量中检测用户语言环境。
 * 依次检查 LANG、LC_ALL、LANGUAGE，无法确定时返回 undefined。
 * @returns 检测到的语言代码，或 undefined
 */
function detectLocale(): Locale | undefined {
  let lang = (process.env.LANG ?? process.env.LC_ALL ?? process.env.LANGUAGE ?? "").toLowerCase();

  // Windows doesn't set LANG/LC_ALL — detect via OS locale
  if (!lang && process.platform === "win32") {
    try {
      lang = execSync("powershell -NoProfile -Command \"(Get-Culture).Name\"", { encoding: "utf8", timeout: 3000 }).trim().toLowerCase();
    } catch { /* ignore */ }
  }

  if (lang.startsWith("zh")) return "zh";
  if (lang.startsWith("fr")) return "fr";
  if (lang.startsWith("en")) return "en";
  return undefined;
}

/**
 * 提示用户选择语言。若能从环境变量自动检测则直接使用，否则弹出交互选择。
 * @returns 用户选择或自动检测的语言代码
 */
export async function selectLanguage(): Promise<Locale> {
  const detected = detectLocale();
  if (detected) { setLocale(detected); return detected; }

  const locale = await p.select({
    message: "Language / 语言 / Langue:",
    options: [
      { value: "en" as Locale, label: "English" },
      { value: "zh" as Locale, label: "中文" },
      { value: "fr" as Locale, label: "Français" },
    ],
  });
  if (p.isCancel(locale)) { p.cancel("Cancelled."); process.exit(0); }
  setLocale(locale);
  return locale;
}
