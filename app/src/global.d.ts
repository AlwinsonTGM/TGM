export {};

declare global {
  interface Capture { id: number; text: string; createdAt: string; goalId: number | null; projectId: number | null; revision: number; goalTitle: string | null; projectName: string | null; targetActive: number | null }
  interface Project { id: number; name: string; folder: string | null; active: boolean }
  interface WorkIntent { goalId: number; stepId: number; goalTitle: string; stepText: string; mode: "independent" | "agy" | "opencode" }
  interface GoalStep { id: number; text: string }
  interface Goal { id: number; title: string; steps: GoalStep[] }
  interface CompletedStep { id: number; goalId: number; goalTitle: string; text: string; completedAt: string }
  interface StepResult { goals: Goal[]; completed: CompletedStep[] }
  interface Window {
    tgm: {
      listCaptures(): Promise<Capture[]>;
      saveCapture(text: string): Promise<Capture>;
      updateCapture(id: number, text: string, goalId: number | null, projectId: number | null, revision: number): Promise<Capture>;
      deleteCapture(id: number, revision: number): Promise<void>;
      listProjects(): Promise<Project[]>;
      createProject(name: string, folder: string | null): Promise<Project[]>;
      updateProject(id: number, name: string, folder: string | null, active: boolean): Promise<Project[]>;
      listGoals(): Promise<Goal[]>;
      createGoal(title: string, firstStep: string): Promise<Goal[]>;
      saveGoalDetails(goalId: number, title: string, stepId: number | null, stepText: string, expectedTitle: string, expectedStep: string): Promise<Goal[]>;
      listCompletedSteps(): Promise<CompletedStep[]>;
      completeStep(goalId: number, stepId: number, expectedText: string): Promise<StepResult>;
      restoreStep(goalId: number, stepId: number): Promise<StepResult>;
    };
    terminalBridge: {
      chooseFolder(): Promise<string | null>;
      checkHarness(id: "agy" | "opencode"): Promise<boolean>;
      start(settings: { harness: "agy" | "opencode"; cwd: string; cols: number; rows: number }): Promise<void>;
      stop(): Promise<boolean>;
      write(data: string): void;
      resize(cols: number, rows: number): void;
      onData(callback: (data: string) => void): () => void;
      onExit(callback: (exitCode: number) => void): () => void;
      copy(text: string): Promise<void>;
      paste(): Promise<string>;
    };
  }
}
