import { useState } from "react";
import { RiskFlag as RiskFlagType } from "../core/types";

export function RiskFlag({ flag }: { flag: RiskFlagType }) {
  const [open, setOpen] = useState(false);
  const active = flag.count > 0;

  return (
    <li className={`risk-flag ${active ? `risk-flag--${flag.severity}` : "risk-flag--idle"}`}>
      <button
        type="button"
        className="risk-flag__row"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="risk-flag__count">[{flag.count}]</span>
        <span className="risk-flag__label">{flag.label}</span>
        <span className="risk-flag__chevron" aria-hidden="true">
          {open ? "–" : "+"}
        </span>
      </button>
      {open && <p className="risk-flag__explanation">{flag.explanation}</p>}
    </li>
  );
}
