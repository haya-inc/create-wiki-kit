#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { version } = require("./package.json");

const TEMPLATE_REPO = "haya-inc/wiki-kit-template";
const TEMPLATE_URL = `https://github.com/${TEMPLATE_REPO}.git`;
const DEFAULT_TEMPLATE_REF =
  process.env.WIKI_KIT_TEMPLATE_REF || "1cdd122825d8c931c0009af90bf46d629835d9e2";
const DEFAULT_PROJECT_NAME = "wiki-kit";

function runGit(args, cwd) {
  execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function copyTemplateFromGit(targetDir, templateRef) {
  console.log("Cloning template...");
  fs.mkdirSync(targetDir, { recursive: true });
  runGit(["init", "--quiet"], targetDir);
  runGit(["remote", "add", "origin", TEMPLATE_URL], targetDir);
  runGit(["fetch", "--depth", "1", "origin", templateRef], targetDir);
  runGit(["checkout", "--quiet", "--detach", "FETCH_HEAD"], targetDir);
  fs.rmSync(path.join(targetDir, ".git"), { recursive: true, force: true });
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
  fs.cpSync(resolvedTemplatePath, targetDir, {
    recursive: true,
    filter: (src) => {
      const baseName = path.basename(src);
      return baseName !== ".git" && baseName !== ".DS_Store";
    },
  });
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
  console.log("  create-wiki-kit [project-name] [--template-path <path>] [--template-ref <ref>]");
  console.log("");
  console.log("Options:");
  console.log("  --template-path <path>  Copy from a local template directory");
  console.log("  --template-ref <ref>    Git ref to fetch from the remote template repository");
  console.log("  -h, --help              Show help");
  console.log("  -v, --version           Show version");
  console.log("");
  console.log("Notes:");
  console.log("  project-name must be a single directory name.");
  console.log("  Use --template-path for local development before pushing wiki-kit-template.");
}

function validateProjectName(projectName) {
  if (!projectName.trim()) {
    throw new Error("project name must not be empty.");
  }

  if (path.isAbsolute(projectName)) {
    throw new Error("project name must be a single directory name.");
  }

  if (projectName === "." || projectName === "..") {
    throw new Error("project name must not be '.' or '..'.");
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
      parsed.templatePath = arg.slice("--template-path=".length);
      continue;
    }

    if (arg === "--template-ref") {
      parsed.templateRef = readOptionValue(args, i, "--template-ref");
      i++;
      continue;
    }

    if (arg.startsWith("--template-ref=")) {
      parsed.templateRef = arg.slice("--template-ref=".length);
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
  const { templatePath, templateRef } = parsedArgs;
  let finalName = parsedArgs.projectName;
  const targetBase = path.resolve(cwd, parsedArgs.projectName);

  if (fs.existsSync(targetBase)) {
    if (parsedArgs.action === "default") {
      let n = 2;
      while (fs.existsSync(path.resolve(cwd, `${parsedArgs.projectName}-${n}`))) {
        n++;
      }
      finalName = `${parsedArgs.projectName}-${n}`;
    } else {
      console.error(`Error: directory already exists: ${parsedArgs.projectName}`);
      process.exit(1);
    }
  }

  const targetDir = path.resolve(cwd, finalName);
  let currentStep = templatePath ? "copy local template" : "clone template";

  try {
    if (templatePath) {
      copyTemplateFromPath(targetDir, path.resolve(cwd, templatePath));
    } else {
      copyTemplateFromGit(targetDir, templateRef);
    }

    currentStep = "remove .gitkeep files";
    removeGitkeep(targetDir);
  } catch (error) {
    fs.rmSync(targetDir, { recursive: true, force: true });
    console.error(`Error: failed to ${currentStep}`);
    console.error(formatError(error));
    process.exit(1);
  }

  console.log("");
  console.log("✔ Wiki kit created");
  console.log("");
  console.log("Next steps:");
  console.log(`  cd ${quoteForShell(finalName)}`);
  console.log("  read README.md");
  console.log("");
}

main();
