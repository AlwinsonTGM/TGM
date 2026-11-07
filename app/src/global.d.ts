export {};

declare global {
  interface Capture {
    id: number;
    text: string;
    createdAt: string;
  }

  interface GoalStep {
    id: number;
    text: string;
  }

  interface Goal {
    id: number;
    title: string;
    steps: GoalStep[];
  }

  interface Window {
    tgm: {
      listCaptures(): Promise<Capture[]>;
      saveCapture(text: string): Promise<Capture>;
      listGoals(): Promise<Goal[]>;
      createGoal(title: string, firstStep: string): Promise<Goal[]>;
      saveGoalDetails(
        goalId: number,
        title: string,
        stepId: number | null,
        stepText: string
      ): Promise<Goal[]>;
    };
  }
}
