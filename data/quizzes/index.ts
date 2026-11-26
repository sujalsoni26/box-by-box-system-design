// Optional knowledge checks, shown after their `afterLesson` and on /practice.
// `lessonSlug` on each question points to the lesson that explains it (used for "review" links).
// Questions test reasoning (scenarios, trade-offs, debugging), not recall of a sentence; answer positions
// are balanced. scripts/validate-practice.mjs checks ids, options, answer positions and lesson order.
// One file per module (data/quizzes/<module>.ts), in course order.
import type { KnowledgeCheck } from "@/types/quiz";
import { checks as foundations } from "./foundations";
import { checks as scaling } from "./scaling";
import { checks as communication } from "./communication";
import { checks as data } from "./data";
import { checks as reliability } from "./reliability";
import { checks as practice } from "./practice";
import { checks as distributed } from "./distributed";
import { checks as internals } from "./internals";
import { checks as streaming } from "./streaming";
import { checks as operations } from "./operations";
import { checks as security } from "./security";
import { checks as infrastructure } from "./infrastructure";
import { checks as architecture } from "./architecture";
import { checks as hld } from "./hld";
import { checks as lld } from "./lld";
import { checks as lldPractice } from "./lld-practice";

export const knowledgeChecks: KnowledgeCheck[] = [...foundations, ...scaling, ...communication, ...data, ...reliability, ...practice, ...distributed, ...internals, ...streaming, ...operations, ...security, ...infrastructure, ...architecture, ...hld, ...lld, ...lldPractice];
