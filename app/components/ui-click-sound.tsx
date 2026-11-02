"use client";
import { useEffect } from "react";
import { isUiSoundTarget, playUiClick } from "@/lib/ui-sound";
export default function UiClickSound() {
  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (event.isTrusted && isUiSoundTarget(event.target)) void playUiClick();
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);
  return null;
}
