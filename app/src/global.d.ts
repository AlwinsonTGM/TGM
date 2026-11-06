export {};

declare global {
  interface Capture {
    id: number;
    text: string;
    createdAt: string;
  }

  interface Window {
    tgm: {
      listCaptures(): Promise<Capture[]>;
      saveCapture(text: string): Promise<Capture>;
    };
  }
}
