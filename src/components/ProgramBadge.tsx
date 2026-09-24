import { ProgramInfo } from "../core/types";

export function ProgramBadge({ program }: { program: ProgramInfo }) {
  return (
    <span className={`program-badge program-badge--${program.known ? program.category : "unknown"}`}>
      {program.name}
    </span>
  );
}
