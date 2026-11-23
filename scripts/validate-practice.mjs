#!/usr/bin/env node
// Validate the practice data: knowledge checks (data/quizzes.ts) and case studies (data/case-studies.ts).
//
//   node scripts/validate-practice.mjs
//
// Knowledge checks:
//   - check ids and question ids are unique; question ids are `<checkId>-<n>`;
//   - moduleId and afterLesson exist, and afterLesson belongs to that module;
//   - every question has exactly 4 distinct options, an answer index in range, a prompt and an explanation;
//   - lessonSlug exists and is taught no later than the check's afterLesson (no untaught concepts);
//   - no two prompts are the same after normalising case and punctuation;
//   - answer positions are not predictable: no position three times in a row within a check, and each
//     position holds 25% ± 10 points of all answers.
// Case studies:
//   - slug is a lesson in module "hld" (track hld) or "lld-practice" (track lld), and appears once;
//   - concepts are existing lessons taught no later than the case itself;
//   - 4–7 steps, each with prompt, hint and insight; 2–4 trade-offs; 2–4 follow-ups.
// Exits 1 if anything is wrong. Reads only files inside this repository.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const problems = [];
const warnings = [];
const fail = (where, msg) => problems.push(`${where}: ${msg}`);

/** Loads a data module that only has type imports, by transpiling it in memory. */
async function loadData(file) {
  const src = readFileSync(path.join(ROOT, file), "utf8");
  const { outputText } = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
    fileName: file,
  });
  if (/^\s*import\s/m.test(outputText)) throw new Error(`${file} has runtime imports; the validator expects type-only imports`);
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { modules, lessonMeta } = await loadData("data/curriculum.ts");
const { knowledgeChecks } = await loadData("data/quizzes.ts");
const { caseStudies } = await loadData("data/case-studies.ts");

const order = modules.flatMap((m) => m.lessons);
const indexOf = new Map(order.map((s, i) => [s, i]));
const moduleOf = new Map(modules.flatMap((m) => m.lessons.map((s) => [s, m.id])));
const levelOf = new Map(lessonMeta.map((l) => [l.slug, l.level]));
const moduleIds = new Set(modules.map((m) => m.id));

// ---------------------------------------------------------------------------------------------
// Knowledge checks
// ---------------------------------------------------------------------------------------------
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const seenChecks = new Set();
const seenQuestionIds = new Set();
const seenPrompts = new Map();
const positions = [0, 0, 0, 0];
let questionCount = 0;

for (const c of knowledgeChecks) {
  const where = `check ${c.id}`;
  if (seenChecks.has(c.id)) fail(where, "duplicate check id");
  seenChecks.add(c.id);
  if (!moduleIds.has(c.moduleId)) fail(where, `unknown moduleId "${c.moduleId}"`);
  if (!indexOf.has(c.afterLesson)) fail(where, `afterLesson "${c.afterLesson}" is not a lesson`);
  else if (moduleOf.get(c.afterLesson) !== c.moduleId) fail(where, `afterLesson "${c.afterLesson}" is not in module "${c.moduleId}"`);
  if (!Array.isArray(c.questions) || c.questions.length === 0) fail(where, "has no questions");
  const limit = indexOf.get(c.afterLesson) ?? -1;
  let run = 0;
  let prev = -1;
  (c.questions ?? []).forEach((q, i) => {
    const qWhere = `${where} question ${q.id}`;
    questionCount++;
    if (q.id !== `${c.id}-${i + 1}`) fail(qWhere, `id should be "${c.id}-${i + 1}"`);
    if (seenQuestionIds.has(q.id)) fail(qWhere, "duplicate question id");
    seenQuestionIds.add(q.id);
    if (!q.prompt?.trim()) fail(qWhere, "empty prompt");
    if (!q.explanation?.trim()) fail(qWhere, "empty explanation");
    if (!Array.isArray(q.options) || q.options.length !== 4) fail(qWhere, "needs exactly 4 options");
    else if (new Set(q.options.map(norm)).size !== 4) fail(qWhere, "options are not distinct");
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options?.length ?? 0)) fail(qWhere, `answer ${q.answer} is out of range`);
    else positions[q.answer]++;
    if (!indexOf.has(q.lessonSlug)) fail(qWhere, `lessonSlug "${q.lessonSlug}" is not a lesson`);
    else if (indexOf.get(q.lessonSlug) > limit) fail(qWhere, `tests "${q.lessonSlug}", which comes after the check's lesson "${c.afterLesson}"`);
    const key = norm(q.prompt ?? "");
    if (seenPrompts.has(key)) fail(qWhere, `same prompt as ${seenPrompts.get(key)}`);
    seenPrompts.set(key, q.id);
    run = q.answer === prev ? run + 1 : 1;
    prev = q.answer;
    if (run >= 3) fail(qWhere, `answer position ${q.answer} three times in a row`);
  });
}
const answered = positions.reduce((a, b) => a + b, 0);
positions.forEach((n, i) => {
  const share = answered ? n / answered : 0;
  if (answered >= 40 && Math.abs(share - 0.25) > 0.1) fail("knowledge checks", `answer position ${i} holds ${Math.round(share * 100)}% of answers (aim for about 25%)`);
});

// ---------------------------------------------------------------------------------------------
// Case studies
// ---------------------------------------------------------------------------------------------
const TRACK_MODULE = { hld: "hld", lld: "lld-practice" };
const seenCases = new Set();
let stepCount = 0;
const filled = (s) => typeof s === "string" && s.trim().length > 0;
const between = (arr, lo, hi) => Array.isArray(arr) && arr.length >= lo && arr.length <= hi && arr.every(filled);

for (const c of caseStudies) {
  const where = `case study ${c.slug}`;
  if (seenCases.has(c.slug)) fail(where, "duplicate slug");
  seenCases.add(c.slug);
  if (!indexOf.has(c.slug)) {
    fail(where, "slug is not a lesson");
    continue;
  }
  if (TRACK_MODULE[c.track] !== moduleOf.get(c.slug)) fail(where, `track "${c.track}" does not match module "${moduleOf.get(c.slug)}"`);
  if (levelOf.get(c.slug) !== c.level) warnings.push(`${where}: level "${c.level}" differs from the lesson's "${levelOf.get(c.slug)}"`);
  for (const f of ["title", "scenario", "focus"]) if (!filled(c[f])) fail(where, `empty ${f}`);
  if (!Number.isFinite(c.minutes) || c.minutes < 10 || c.minutes > 90) fail(where, `minutes ${c.minutes} is outside 10–90`);
  if (!Array.isArray(c.concepts) || c.concepts.length === 0) fail(where, "needs concepts");
  for (const s of c.concepts ?? []) {
    if (!indexOf.has(s)) fail(where, `concept "${s}" is not a lesson`);
    else if (indexOf.get(s) > indexOf.get(c.slug)) fail(where, `concept "${s}" comes after the case in the curriculum`);
  }
  if (new Set(c.concepts ?? []).size !== (c.concepts ?? []).length) fail(where, "duplicate concepts");
  if (!Array.isArray(c.steps) || c.steps.length < 4 || c.steps.length > 7) fail(where, "needs 4–7 steps");
  (c.steps ?? []).forEach((s, i) => {
    stepCount++;
    for (const f of ["prompt", "hint", "insight"]) if (!filled(s[f])) fail(where, `step ${i + 1} has an empty ${f}`);
  });
  if (!between(c.tradeoffs, 2, 4)) fail(where, "needs 2–4 trade-offs");
  if (!between(c.followUps, 2, 4)) fail(where, "needs 2–4 follow-ups");
}

// ---------------------------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------------------------
for (const w of warnings) console.warn(`warning  ${w}`);
if (problems.length) {
  for (const p of problems) console.error(`error    ${p}`);
  console.error(`\n${problems.length} problem(s) in the practice data.`);
  process.exit(1);
}
const pct = positions.map((n) => `${Math.round((n / (answered || 1)) * 100)}%`).join("/");
console.log(
  `OK: ${knowledgeChecks.length} knowledge checks, ${questionCount} questions (answer positions A/B/C/D ${pct}); ` +
    `${caseStudies.length} case studies, ${stepCount} steps.`,
);
