import { useEffect } from "react";

export default function Landing({ onEnter }: { onEnter: () => void }) {
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data === "enter_system") onEnter();
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onEnter]);

  return (
    <iframe
      src="/segurid-landing.html"
      style={{ width: "100%", height: "100vh", border: "none", display: "block" }}
      title="Segurid"
    />
  );
}
