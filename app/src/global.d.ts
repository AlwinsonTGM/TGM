export {};

declare global {
  interface Capture { id: number; text: string; createdAt: string }
  interface GoalStep { id: number; text: string }
  interface Goal { id: number; title: string; steps: GoalStep[] }
  interface Window {
    tgm: {
      listCaptures(): Promise<Capture[]>;
      saveCapture(text: string): Promise<Capture>;
      listGoals(): Promise<Goal[]>;
      createGoal(title: string, firstStep: string): Promise<Goal[]>;
      saveGoalDetails(goalId: number, title: string, stepId: number | null, stepText: string, expectedTitle: string, expectedStep: string): Promise<Goal[]>;
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
