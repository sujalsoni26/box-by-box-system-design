// The course: modules (data/curriculum/modules.ts) and each module's lessons (data/curriculum/lessons/<module>.ts).
// Lesson bodies live in content/lessons/<slug>.mdx; teaching guidance lives in data/lesson-guides/.
import type { LessonMeta } from "@/types/curriculum";
import { lessons as foundations } from "./lessons/foundations";
import { lessons as scaling } from "./lessons/scaling";
import { lessons as communication } from "./lessons/communication";
import { lessons as data } from "./lessons/data";
import { lessons as reliability } from "./lessons/reliability";
import { lessons as practice } from "./lessons/practice";
import { lessons as distributed } from "./lessons/distributed";
import { lessons as internals } from "./lessons/internals";
import { lessons as streaming } from "./lessons/streaming";
import { lessons as operations } from "./lessons/operations";
import { lessons as security } from "./lessons/security";
import { lessons as infrastructure } from "./lessons/infrastructure";
import { lessons as architecture } from "./lessons/architecture";
import { lessons as hld } from "./lessons/hld";
import { lessons as lld } from "./lessons/lld";
import { lessons as lldPractice } from "./lessons/lld-practice";

export { modules } from "./modules";

/** Every lesson's details, module by module. Course order comes from `modules` (lib/curriculum.ts). */
export const lessonMeta: LessonMeta[] = [...foundations, ...scaling, ...communication, ...data, ...reliability, ...practice, ...distributed, ...internals, ...streaming, ...operations, ...security, ...infrastructure, ...architecture, ...hld, ...lld, ...lldPractice];
