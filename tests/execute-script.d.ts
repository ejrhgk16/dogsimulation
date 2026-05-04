declare module '../../tools/scripts/execute.mjs' {
  export type StepStatus = 'pending' | 'completed' | 'error' | 'blocked';

  export interface StepRecord {
    step: number;
    name?: string;
    status: StepStatus;
    summary?: string;
    error_message?: string;
    blocked_reason?: string;
    completed_at?: string;
    failed_at?: string;
    blocked_at?: string;
  }

  export interface PhaseIndex {
    project?: string;
    phase?: string;
    steps: StepRecord[];
    completed_at?: string;
  }

  export interface PhaseSummary {
    phaseDirName: string;
    phaseName: string;
    projectName: string;
    currentStep: StepRecord | null;
    completedSteps: number;
    totalSteps: number;
    phaseStatus: StepStatus;
    phaseIndex: PhaseIndex;
    paths: {
      phasesDir: string;
      phaseDir: string;
      topIndexFile: string;
      phaseIndexFile: string;
    };
  }

  export function stamp(date?: Date): string;
  export function derivePhaseStatus(phaseIndex: PhaseIndex): StepStatus;
  export function getPhaseSummary(rootDir: string, providedPhaseDirName?: string): PhaseSummary;
  export function buildNextAction(summary: PhaseSummary): Record<string, unknown>;
  export function markStepCompleted(
    rootDir: string,
    phaseDirName: string,
    stepNumber: number,
    stepSummary: string
  ): { summary: PhaseSummary; changedFiles: string[] };
  export function markStepBlocked(
    rootDir: string,
    phaseDirName: string,
    stepNumber: number,
    blockedReason: string
  ): { summary: PhaseSummary; changedFiles: string[] };
  export function resetStep(
    rootDir: string,
    phaseDirName: string,
    stepNumber: number
  ): { summary: PhaseSummary; changedFiles: string[] };
  export function runCli(
    argv: string[],
    options?: {
      rootDir?: string;
      stdout?: { write(value: string): void };
      stderr?: { write(value: string): void };
    }
  ): number;
}
