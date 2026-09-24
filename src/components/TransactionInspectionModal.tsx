import { useEffect } from "react";
import { InspectionResult } from "../core/types";
import { ProgramBadge } from "./ProgramBadge";
import { EffectRow } from "./EffectRow";
import { RiskFlag } from "./RiskFlag";

interface Props {
  result: InspectionResult;
  onApprove: () => void;
  onReject: () => void;
}

const SEVERITY_COPY: Record<InspectionResult["overallSeverity"], string> = {
  info: "No standing authority changes detected",
  warning: "Review before signing",
  danger: "This transaction requests standing authority"
};

export function TransactionInspectionModal({ result, onApprove, onReject }: Props) {
  // Lock the background page while the panel is open, so there's only
  // ever one scrollable surface on screen — the panel itself.
  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const [primaryProgram, ...otherPrograms] = result.programs;

  return (
    <div className="inspection-backdrop" role="dialog" aria-modal="true" aria-label="Transaction inspection">
      <div className={`inspection-panel inspection-panel--${result.overallSeverity}`}>
        <header className="inspection-panel__header">
          <span className="inspection-panel__title">Transaction Inspection</span>
          <span className={`inspection-panel__status inspection-panel__status--${result.overallSeverity}`}>
            {SEVERITY_COPY[result.overallSeverity]}
          </span>
        </header>

        <div className="inspection-panel__scroll">
          <section className="inspection-panel__section">
            <h3 className="inspection-panel__label">Program</h3>
            <div className="inspection-panel__programs">
              {primaryProgram && <ProgramBadge program={primaryProgram} />}
              {otherPrograms.map((p) => (
                <ProgramBadge key={p.address} program={p} />
              ))}
              {result.programs.length === 0 && <span className="inspection-panel__muted">No instructions</span>}
            </div>
          </section>

          <hr className="inspection-panel__rule" />

          <section className="inspection-panel__section">
            <h3 className="inspection-panel__label">Instructions</h3>
            <ul className="inspection-panel__checklist">
              {result.instructions.map((ix, i) => (
                <li key={i} className={ix.opaque && ix.programName.startsWith("Unknown") ? "is-unidentified" : ""}>
                  <span aria-hidden="true">{ix.opaque && ix.programName.startsWith("Unknown") ? "?" : "✓"}</span>{" "}
                  {ix.instructionName}
                </li>
              ))}
            </ul>
          </section>

          <hr className="inspection-panel__rule" />

          <section className="inspection-panel__section">
            <h3 className="inspection-panel__label">Potential effects</h3>
            {result.effects.length > 0 ? (
              <ul className="inspection-panel__effects">
                {result.effects.map((effect) => (
                  <EffectRow key={effect.id} effect={effect} />
                ))}
              </ul>
            ) : (
              <p className="inspection-panel__muted">No spending or authority changes found.</p>
            )}
          </section>

          <hr className="inspection-panel__rule" />

          <section className="inspection-panel__section">
            <h3 className="inspection-panel__label">Risk flags</h3>
            <ul className="inspection-panel__risk-flags">
              {result.riskFlags.map((flag) => (
                <RiskFlag key={flag.id} flag={flag} />
              ))}
            </ul>
          </section>
        </div>

        <footer className="inspection-panel__actions">
          <button type="button" className="btn btn--ghost" onClick={onReject}>
            Cancel
          </button>
          <button type="button" className={`btn btn--sign btn--sign-${result.overallSeverity}`} onClick={onApprove}>
            Sign
          </button>
        </footer>
      </div>
    </div>
  );
}
