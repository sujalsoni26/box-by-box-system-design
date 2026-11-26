// Teaching guidance per lesson: what breaks, the trade-off, a plain-language explanation and a hint.
// Facts follow the lesson bodies in content/lessons/<slug>.mdx. One entry per lesson slug.
// One file per module (data/lesson-guides/<module>.ts).
import type { LessonGuide } from "@/types/curriculum";
import { guides as foundations } from "./foundations";
import { guides as scaling } from "./scaling";
import { guides as communication } from "./communication";
import { guides as data } from "./data";
import { guides as reliability } from "./reliability";
import { guides as practice } from "./practice";
import { guides as distributed } from "./distributed";
import { guides as internals } from "./internals";
import { guides as streaming } from "./streaming";
import { guides as operations } from "./operations";
import { guides as security } from "./security";
import { guides as infrastructure } from "./infrastructure";
import { guides as architecture } from "./architecture";
import { guides as hld } from "./hld";
import { guides as lld } from "./lld";
import { guides as lldPractice } from "./lld-practice";

export const lessonGuides: Record<string, LessonGuide> = { ...foundations, ...scaling, ...communication, ...data, ...reliability, ...practice, ...distributed, ...internals, ...streaming, ...operations, ...security, ...infrastructure, ...architecture, ...hld, ...lld, ...lldPractice };
