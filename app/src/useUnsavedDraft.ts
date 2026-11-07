import { useEffect } from "react";

export function useUnsavedDraft(hasDraft: boolean) {
  useEffect(() => {
    if (!hasDraft) return;
    const protectDraft = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, [hasDraft]);
}
