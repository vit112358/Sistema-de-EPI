import type { Toast } from "../types";

export function ToastContainer({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === "success" ? "✅" : t.type === "error" ? "❌" : "ℹ️"}
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}