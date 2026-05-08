import { useState } from "react";
import type { Toast } from "../types";

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = (msg: string, type: Toast['type'] = "info") => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };
  return { toasts, add };
}