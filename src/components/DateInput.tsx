import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

interface Props {
  value: string;
  onChange: (iso: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

const MESES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DIAS  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

function isoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function isoToParts(iso: string) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { year: y, month: m - 1, day: d };
}

const NAV_BTN: React.CSSProperties = {
  background: "transparent", border: "1px solid var(--border2)", borderRadius: 6,
  color: "var(--text1)", cursor: "pointer", fontSize: 18, width: 28, height: 28,
  display: "flex", alignItems: "center", justifyContent: "center",
};

export function DateInput({ value, onChange, className, style }: Props) {
  const today   = new Date();
  const initial = isoToParts(value);
  const [display,   setDisplay]   = useState(() => isoToDisplay(value));
  const [open,      setOpen]      = useState(false);
  const [viewYear,  setViewYear]  = useState(initial?.year  ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial?.month ?? today.getMonth());
  const [calPos, setCalPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  const wrapRef = useRef<HTMLDivElement>(null);
  const calRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisplay(isoToDisplay(value));
    const p = isoToParts(value);
    if (p) { setViewYear(p.year); setViewMonth(p.month); }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapRef.current && !wrapRef.current.contains(target) &&
        calRef.current  && !calRef.current.contains(target)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const openCalendar = () => {
    if (wrapRef.current) {
      const r = wrapRef.current.getBoundingClientRect();
      // flip up if not enough space below
      const calHeight = 300;
      const top = r.bottom + calHeight > window.innerHeight
        ? r.top - calHeight - 4
        : r.bottom + 4;
      setCalPos({ top, left: r.left, width: r.width });
    }
    setOpen(o => !o);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4)}`;
    else if (digits.length > 2) formatted = `${digits.slice(0,2)}/${digits.slice(2)}`;
    setDisplay(formatted);
    if (digits.length === 8) {
      onChange(`${digits.slice(4)}-${digits.slice(2,4)}-${digits.slice(0,2)}`);
      setOpen(false);
    } else if (digits.length === 0) {
      onChange("");
    }
  };

  const handleBlur = () => setDisplay(isoToDisplay(value));

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  };

  const selectToday = () => {
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    onChange(`${today.getFullYear()}-${mm}-${dd}`);
    setOpen(false);
  };

  const selected  = isoToParts(value);
  const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDay  = new Date(viewYear, viewMonth, 1).getDay();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const calendar = open ? createPortal(
    <div
      ref={calRef}
      style={{
        position: "fixed", top: calPos.top, left: calPos.left,
        minWidth: Math.max(calPos.width, 264),
        zIndex: 9999,
        background: "var(--surface2)", border: "1px solid var(--border2)",
        borderRadius: 10, padding: 12,
        boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <button type="button" onClick={prevMonth} style={NAV_BTN}>‹</button>
        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text1)" }}>
          {MESES[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth} style={NAV_BTN}>›</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: 4 }}>
        {DIAS.map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--text3)", padding: "2px 0" }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {cells.map((day, i) => {
          const isSel   = day !== null && selected?.year === viewYear && selected?.month === viewMonth && selected?.day === day;
          const isToday = day !== null && today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;
          return (
            <button
              key={i}
              type="button"
              disabled={day === null}
              onClick={() => day !== null && selectDay(day)}
              style={{
                height: 32, borderRadius: 6,
                border: isToday && !isSel ? "1px solid var(--primary)" : "none",
                background: isSel ? "var(--primary)" : "transparent",
                color: isSel ? "#000" : day === null ? "transparent" : "var(--text1)",
                cursor: day === null ? "default" : "pointer",
                fontSize: 13, fontWeight: isSel ? 700 : 400,
                transition: "background 0.15s",
              }}
              onMouseEnter={e => { if (!isSel && day !== null) (e.currentTarget as HTMLButtonElement).style.background = "var(--border2)"; }}
              onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              {day ?? ""}
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 10, textAlign: "center", borderTop: "1px solid var(--border2)", paddingTop: 8 }}>
        <button type="button" onClick={selectToday} style={{
          fontSize: 12, color: "var(--primary)", background: "transparent",
          border: "none", cursor: "pointer", fontWeight: 600,
        }}>
          Hoje
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div ref={wrapRef} style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", ...style }}>
      <input
        type="text"
        className={className}
        style={{ flex: 1, paddingRight: 34 }}
        value={display}
        onChange={handleTextChange}
        onBlur={handleBlur}
        placeholder="dd/mm/aaaa"
        maxLength={10}
      />
      <button
        type="button"
        tabIndex={-1}
        onMouseDown={e => { e.preventDefault(); openCalendar(); }}
        style={{
          position: "absolute", right: 8, background: "transparent", border: "none",
          cursor: "pointer", fontSize: 15, padding: 0, lineHeight: 1, color: "var(--text3)",
        }}
      >🗓</button>
      {calendar}
    </div>
  );
}