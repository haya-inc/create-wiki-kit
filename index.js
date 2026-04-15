#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { version } = require("./package.json");

const TEMPLATE_REPO = "haya-inc/wiki-kit-template";
const TEMPLATE_URL = `https://github.com/${TEMPLATE_REPO}.git`;
const DEFAULT_TEMPLATE_REF =
  process.env.WIKI_KIT_TEMPLATE_REF || "9b73c2ba532da876690bf43af3c05f80b59c62d0";
const DEFAULT_PROJECT_NAME = "wiki-kit";
const DEFAULT_LOCALE = "en";
const SUPPORTED_LOCALES = [
  "de", "en", "es", "fr", "id", "it", "ja", "ko", "pt", "ru", "th", "tr", "vi", "zh",
];

// File/directory names to skip when copying template trees.
const IGNORED_COPY_NAMES = new Set([".git", ".DS_Store", "Thumbs.db"]);

function copyFilter(src) {
  return !IGNORED_COPY_NAMES.has(path.basename(src));
}

function runGit(args, cwd) {
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function copyTemplateFromGit(targetDir, templateRef) {
  console.log("Cloning template...");

  // Clone into a temporary directory first to avoid conflicts with existing
  // files (e.g. .git) in targetDir.
  const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "wiki-kit-"));

  try {
    runGit(["init", "--quiet"], tmpDir);
    runGit(["remote", "add", "origin", TEMPLATE_URL], tmpDir);
    runGit(["fetch", "--depth", "1", "origin", templateRef], tmpDir);
    runGit(["checkout", "--quiet", "--detach", "FETCH_HEAD"], tmpDir);
    fs.rmSync(path.join(tmpDir, ".git"), { recursive: true, force: true });

    fs.mkdirSync(targetDir, { recursive: true });
    fs.cpSync(tmpDir, targetDir, { recursive: true, filter: copyFilter });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function copyTemplateFromPath(targetDir, templatePath) {
  const resolvedTemplatePath = path.resolve(templatePath);

  if (!fs.existsSync(resolvedTemplatePath)) {
    throw new Error(`template path does not exist: ${templatePath}`);
  }

  if (!fs.statSync(resolvedTemplatePath).isDirectory()) {
    throw new Error(`template path must be a directory: ${templatePath}`);
  }

  console.log(`Copying template from local path: ${resolvedTemplatePath}`);
  fs.mkdirSync(targetDir, { recursive: true });
  fs.cpSync(resolvedTemplatePath, targetDir, { recursive: true, filter: copyFilter });
}

function applyLocale(targetDir, locale) {
  const localesDir = path.join(targetDir, "locales");

  if (!fs.existsSync(localesDir)) {
    return;
  }

  const localeDir = path.join(localesDir, locale);

  if (!fs.existsSync(localeDir)) {
    console.warn(`Warning: locale "${locale}" not found in template; using defaults.`);
    fs.rmSync(localesDir, { recursive: true, force: true });
    return;
  }

  // Recursively overwrite files from the locale directory into the project root
  fs.cpSync(localeDir, targetDir, { recursive: true });

  // Remove locales directory from the generated project
  fs.rmSync(localesDir, { recursive: true, force: true });
}

function removeGitkeep(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      removeGitkeep(fullPath);
    } else if (entry.isFile() && entry.name === ".gitkeep") {
      fs.unlinkSync(fullPath);
    }
  }
}

function formatError(error) {
  if (error && error.code === "ENOENT" && error.path === "git") {
    return "git is required but was not found in PATH.";
  }

  if (error && typeof error.stderr === "string" && error.stderr.trim()) {
    return error.stderr.trim();
  }

  if (error && typeof error.message === "string" && error.message.trim()) {
    return error.message.trim();
  }

  return "unknown error";
}

function quoteForShell(value) {
  if (process.platform === "win32") {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return `'${value.replaceAll("'", "'\\''")}'`;
}

function printHelp() {
  console.log("Usage:");
  console.log("  create-wiki-kit [project-name] [options]");
  console.log("");
  console.log("Options:");
  console.log("  --locale <locale>       Language for CLAUDE.md and templates. Default: en");
  console.log("                          Supported: de, en, es, fr, id, it, ja, ko, pt, ru, th, tr, vi, zh");
  console.log("  --template-path <path>  Copy from a local template directory");
  console.log("  --template-ref <ref>    Git ref to fetch from the remote template repository");
  console.log("  -h, --help              Show help");
  console.log("  -v, --version           Show version");
  console.log("");
  console.log("Notes:");
  console.log("  project-name can be a directory name or '.' for the current directory.");
  console.log("  If the directory already exists, it must contain only safe files");
  console.log("  (e.g. .git, .gitignore, LICENSE, README.md).");
  console.log("  Use --template-path for local development before pushing wiki-kit-template.");
}

// Files and directories that are safe to exist in a target directory.
// Matching is case-insensitive.
const SAFE_FILES = new Set([
  ".ds_store",
  ".git",
  ".gitattributes",
  ".gitignore",
  ".gitlab-ci.yml",
  ".hg",
  ".hgcheck",
  ".hgignore",
  ".idea",
  ".npmignore",
  ".travis.yml",
  ".vscode",
  "license",
  "readme.md",
  "thumbs.db",
]);

function isFolderSafe(dir) {
  const conflicts = [];

  for (const entry of fs.readdirSync(dir)) {
    if (!SAFE_FILES.has(entry.toLowerCase())) {
      conflicts.push(entry);
    }
  }

  return { safe: conflicts.length === 0, conflicts };
}

function validateProjectName(projectName) {
  if (!projectName.trim()) {
    throw new Error("project name must not be empty.");
  }

  if (path.isAbsolute(projectName)) {
    throw new Error("project name must be a single directory name.");
  }

  if (projectName === "..") {
    throw new Error("project name must not be '..'.");
  }

  // "." is allowed — it means "use the current directory"
  if (projectName === ".") {
    return;
  }

  if (projectName.includes("/") || projectName.includes("\\")) {
    throw new Error("project name must be a single directory name.");
  }

  if (projectName.startsWith("-")) {
    throw new Error(`unknown option: ${projectName}`);
  }
}

function readOptionValue(args, index, optionName) {
  const value = args[index + 1];

  if (!value || value.startsWith("-")) {
    throw new Error(`${optionName} requires a value.`);
  }

  return value;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = {
    action: "default",
    projectName: DEFAULT_PROJECT_NAME,
    templatePath: null,
    templateRef: DEFAULT_TEMPLATE_REF,
    templateRefExplicit: false,
    locale: DEFAULT_LOCALE,
  };
  let positionalSeen = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      return { action: "help" };
    }

    if (arg === "-v" || arg === "--version") {
      return { action: "version" };
    }

    if (arg === "--template-path") {
      parsed.templatePath = readOptionValue(args, i, "--template-path");
      i++;
      continue;
    }

    if (arg.startsWith("--template-path=")) {
      const value = arg.slice("--template-path=".length);

      if (!value) {
        throw new Error("--template-path requires a value.");
      }

      parsed.templatePath = value;
      continue;
    }

    if (arg === "--template-ref") {
      parsed.templateRef = readOptionValue(args, i, "--template-ref");
      parsed.templateRefExplicit = true;
      i++;
      continue;
    }

    if (arg.startsWith("--template-ref=")) {
      const value = arg.slice("--template-ref=".length);

      if (!value) {
        throw new Error("--template-ref requires a value.");
      }

      parsed.templateRef = value;
      parsed.templateRefExplicit = true;
      continue;
    }

    if (arg === "--locale") {
      const locale = readOptionValue(args, i, "--locale");

      if (!SUPPORTED_LOCALES.includes(locale)) {
        throw new Error(`unsupported locale: ${locale}. Supported: ${SUPPORTED_LOCALES.join(", ")}`);
      }

      parsed.locale = locale;
      i++;
      continue;
    }

    if (arg.startsWith("--locale=")) {
      const locale = arg.slice("--locale=".length);

      if (!locale) {
        throw new Error("--locale requires a value.");
      }

      if (!SUPPORTED_LOCALES.includes(locale)) {
        throw new Error(`unsupported locale: ${locale}. Supported: ${SUPPORTED_LOCALES.join(", ")}`);
      }

      parsed.locale = locale;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`unknown option: ${arg}`);
    }

    if (positionalSeen) {
      throw new Error("expected at most one project name.");
    }

    validateProjectName(arg);
    parsed.projectName = arg;
    parsed.action = "create";
    positionalSeen = true;
  }

  if (parsed.templatePath && parsed.templateRefExplicit) {
    throw new Error("--template-path and --template-ref are mutually exclusive.");
  }

  return parsed;
}

function main() {
  let parsedArgs;

  try {
    parsedArgs = parseArgs(process.argv);
  } catch (error) {
    console.error(`Error: ${formatError(error)}`);
    process.exit(1);
  }

  if (parsedArgs.action === "help") {
    printHelp();
    return;
  }

  if (parsedArgs.action === "version") {
    console.log(version);
    return;
  }

  const cwd = process.cwd();
  const { templatePath, templateRef, locale } = parsedArgs;
  const isCurrentDir = parsedArgs.projectName === ".";
  const targetDir = path.resolve(cwd, parsedArgs.projectName);
  const displayName = isCurrentDir ? "." : parsedArgs.projectName;
  const finalName = isCurrentDir ? path.basename(targetDir) : parsedArgs.projectName;
  let createdDir = false;

  if (fs.existsSync(targetDir)) {
    const stat = fs.statSync(targetDir);

    if (!stat.isDirectory()) {
      console.error(`Error: ${displayName} exists and is not a directory.`);
      process.exit(1);
    }

    const { safe, conflicts } = isFolderSafe(targetDir);

    if (!safe) {
      console.error(`Error: directory ${displayName} contains files that could conflict:`);
      console.error("");

      for (const file of conflicts) {
        console.error(`  ${file}`);
      }

      console.error("");
      console.error("Either use a new directory name, or remove these files first.");
      process.exit(1);
    }
  } else {
    createdDir = true;
  }

  let currentStep = templatePath ? "copy local template" : "clone template";

  try {
    if (templatePath) {
      copyTemplateFromPath(targetDir, path.resolve(cwd, templatePath));
    } else {
      copyTemplateFromGit(targetDir, templateRef);
    }

    currentStep = "apply locale";
    applyLocale(targetDir, locale);

    currentStep = "remove .gitkeep files";
    removeGitkeep(targetDir);
  } catch (error) {
    // Only remove the directory if we created it — never rm the user's
    // existing directory on failure.
    if (createdDir) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    console.error(`Error: failed to ${currentStep}`);
    console.error(formatError(error));
    process.exit(1);
  }

  console.log("");
  console.log("✔ Wiki kit created");
  console.log("");

  if (isCurrentDir) {
    console.log("Next steps:");
    console.log("  read README.md");
  } else {
    console.log("Next steps:");
    console.log(`  cd ${quoteForShell(finalName)}`);
    console.log("  read README.md");
  }

  console.log("");
}

main();
