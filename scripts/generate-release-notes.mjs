#!/usr/bin/env node
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [, , tagArg, outFileArg] = process.argv;

const toSafe = (value) => String(value ?? "").trim();

function run(cmd) {
  return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function resolveTargetTag(input) {
  if (input) {
    return input.trim();
  }
  const tag = toSafe(run("git describe --tags --abbrev=0")).trim();
  if (!tag) {
    throw new Error("릴리즈 태그를 찾지 못했습니다. 태그 인자를 전달해 주세요.");
  }
  return tag;
}

function previousTagOf(target) {
  const tagList = run("git tag --sort=-creatordate")
    .split("\n")
    .map((value) => value.trim())
    .filter(Boolean);
  const index = tagList.indexOf(target);
  if (index === -1) {
    return undefined;
  }
  return tagList[index + 1];
}

function commitMessage(message) {
  return message.trim().replace(/^\[.*?\]\s*/, "");
}

function classify(message) {
  const normalized = message.toLowerCase();
  const matched = normalized.match(/^([a-z]+)(\([^)]+\))?:/);
  if (!matched) {
    return "chore";
  }

  const type = matched[1];
  if (type === "feat") {
    return "feat";
  }
  if (type === "fix") {
    return "fix";
  }
  if (type === "chore") {
    return "chore";
  }
  if (type === "docs") {
    return "docs";
  }
  if (type === "test") {
    return "test";
  }
  if (type === "refactor") {
    return "refactor";
  }
  if (type === "build") {
    return "build";
  }
  if (type === "ci") {
    return "chore";
  }
  if (type === "perf") {
    return "refactor";
  }

  return "chore";
}

function escape(message) {
  return message.replace(/^[-*]/u, "\\$&");
}

function markdownList(items) {
  if (items.length === 0) {
    return "- 해당 구간 변경사항 없음";
  }
  return items.map((item) => `- ${escape(item)}`).join("\n");
}

try {
  const tag = resolveTargetTag(tagArg);
  const previous = previousTagOf(tag);
  const compareRange = previous ? `${previous}..${tag}` : `${tag}~20..${tag}`;

  const commitLog = run(`git log --oneline --no-decorate ${compareRange}`)
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => {
      const [sha, ...rest] = line.trim().split(" ");
      return {
        sha,
        message: rest.join(" ")
      };
    });

  const grouped = {
    feat: [],
    fix: [],
    chore: [],
    docs: [],
    refactor: [],
    test: [],
    build: []
  };

  for (const commit of commitLog) {
    const normalizedMessage = commitMessage(commit.message);
    const kind = classify(normalizedMessage);
    const normalized =
      normalizedMessage.length > 0
        ? `${normalizedMessage} (${commit.sha})`
        : `변경사항 업데이트 (${commit.sha})`;

    if (Object.prototype.hasOwnProperty.call(grouped, kind)) {
      grouped[kind].push(normalized);
      continue;
    }
    grouped.chore.push(normalized);
  }

  const output = [
    `# RoutineMate Release Notes (${tag})`,
    "",
    `- 기준 태그: ${previous ?? "(초기 릴리스 또는 태그 미확인)"}`,
    `- 배포 시각: ${new Date().toISOString()}`,
    "",
    "## Summary",
    markdownList(
      [
        ...grouped.feat.map((item) => `${item}`),
        ...grouped.fix.map((item) => `${item}`),
        ...grouped.chore.map((item) => `${item}`)
      ].slice(0, 8)
    ),
    "",
    "## Details",
    "",
    "### Features",
    markdownList(grouped.feat),
    "",
    "### Fixes",
    markdownList(grouped.fix),
    "",
    "### Chores",
    markdownList(grouped.chore),
    "",
    "### Docs/Tests/Refactor",
    markdownList([...grouped.docs, ...grouped.test, ...grouped.refactor, ...grouped.build]),
    "",
    `- Web: https://routinemate-kohl.vercel.app`
  ].join("\n");

  const outputPath = outFileArg || path.join(process.cwd(), "dist", "releases", `release-notes-${tag}.md`);
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, output, "utf8");
  console.log(outputPath);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
