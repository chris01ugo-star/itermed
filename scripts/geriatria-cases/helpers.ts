import type { ExamRow, Question, Resolution, Step } from "./types";

export const q = (
  id: string,
  prompt: string,
  expectedKeywords: string[],
  rationale: string,
  critical = true,
): Question => ({ id, prompt, critical, expectedKeywords, rationale });

export const exam = (
  examId: string,
  name: string,
  finding: string,
  isAbnormal: boolean,
  priceEuro: number,
  wasteRationale?: string,
): ExamRow => ({
  examId,
  name,
  finding,
  isAbnormal,
  priceEuro,
  ...(wasteRationale ? { wasteRationale } : {}),
});

export const step = (
  phase: Step["phase"],
  title: string,
  prompt: string,
  cost: number,
  score: number,
  correctLabel: string,
  wrongs: Step["wrongs"],
): Step => ({ phase, title, prompt, cost, score, correctLabel, wrongs });

export const done = (
  id: string,
  outcome: Resolution["outcome"],
  title: string,
  prompt: string,
  cost: number,
  score: number,
  trap?: Resolution["trap"],
): Resolution => ({ id, outcome, title, prompt, cost, score, ...(trap ? { trap } : {}) });
