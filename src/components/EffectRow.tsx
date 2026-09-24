import { TransactionEffect } from "../core/types";

const MARKER: Record<TransactionEffect["severity"], string> = {
  info: "·",
  warning: "!",
  danger: "!"
};

export function EffectRow({ effect }: { effect: TransactionEffect }) {
  return (
    <li className={`effect-row effect-row--${effect.severity}`}>
      <span className="effect-row__marker" aria-hidden="true">
        {MARKER[effect.severity]}
      </span>
      <span className="effect-row__text">
        <span className="effect-row__summary">{effect.summary}</span>
        {effect.detail && <span className="effect-row__detail">{effect.detail}</span>}
      </span>
    </li>
  );
}
