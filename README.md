# create-wiki-kit

CLI to scaffold a [wiki-kit](https://github.com/haya-inc/wiki-kit-template) project.

## Quick Start

```bash
npx create-wiki-kit my-wiki
cd my-wiki
```

This clones the wiki-kit template, applies the selected locale, and leaves a ready-to-use project.

## Prerequisites

- Node.js 20+
- git

## Usage

```bash
npx create-wiki-kit [project-name] [options]
```

`project-name` defaults to `wiki-kit` if omitted. Use `.` to scaffold into the current directory.

```bash
# New directory
npx create-wiki-kit my-wiki

# Current directory
mkdir my-wiki && cd my-wiki
npx create-wiki-kit .

# Existing directory (must contain only safe files)
cd my-repo
npx create-wiki-kit .

# Japanese locale
npx create-wiki-kit my-wiki --locale ja
```

If the target directory already exists, it must contain only safe files (`.git`, `.gitignore`, `LICENSE`, `README.md`, etc.). Any other files are treated as conflicts and the command exits with an error listing them.

## Options

| Option | Description |
|---|---|
| `--locale <code>` | Language for all generated files. Default: `en` |
| `--template-path <path>` | Copy from a local template directory instead of fetching from GitHub |
| `--template-ref <ref>` | Git ref to fetch from the remote template repository |
| `-h`, `--help` | Show help |
| `-v`, `--version` | Show version |

## Locales

14 languages are supported. The `--locale` option determines the language of `CLAUDE.md`, templates, wiki scaffolding, and all README files.

| Code | Language | Code | Language |
|------|------------|------|------------|
| `de` | German | `ko` | Korean |
| `en` | English | `pt` | Portuguese |
| `es` | Spanish | `ru` | Russian |
| `fr` | French | `th` | Thai |
| `id` | Indonesian | `tr` | Turkish |
| `it` | Italian | `vi` | Vietnamese |
| `ja` | Japanese | `zh` | Chinese |

## What It Does

1. Fetches the template from [wiki-kit-template](https://github.com/haya-inc/wiki-kit-template)
2. Applies the selected locale (overwrites root files from `locales/<code>/`, then removes `locales/`)
3. Removes git history and `.gitkeep` files

## Local Development

Test with a local clone of `wiki-kit-template` before pushing:

```bash
node index.js my-wiki --template-path ../wiki-kit-template
```

Override the fetch ref if needed:

```bash
node index.js my-wiki --template-ref <commit-sha>
```

## Template

- Repository: https://github.com/haya-inc/wiki-kit-template
- Pinned ref: `9b73c2ba532da876690bf43af3c05f80b59c62d0`

## Inspiration

wiki-kit is based on the [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) pattern by Andrej Karpathy — a design where an LLM incrementally builds and maintains a structured wiki from raw sources, rather than retrieving documents at query time.

## Release

- GitHub Release tags must match the version in `package.json`. A `v` prefix is allowed.
- Prereleases are published under the `next` dist-tag on npm; only stable releases go to `latest`.
