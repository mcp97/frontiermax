import type { ComparedCandidate } from "../../../lib/control-plane";

export default function ParetoChart({
  candidates,
  qualityFloor,
  maximumCost,
}: {
  candidates: ComparedCandidate[];
  qualityFloor: number;
  maximumCost: number | null;
}) {
  const measured = candidates.filter((candidate) => candidate.average_cost_per_case != null);
  const maxCost = Math.max(...measured.map((candidate) => candidate.average_cost_per_case ?? 0), maximumCost ?? 0, 0.01);
  const x = (cost: number) => 70 + (cost / maxCost) * 650;
  const y = (quality: number) => 330 - quality * 260;
  const frontier = measured
    .filter((candidate) => candidate.pareto)
    .sort((a, b) => (a.average_cost_per_case ?? 0) - (b.average_cost_per_case ?? 0));

  return (
    <div className="pareto-visual">
      <svg viewBox="0 0 780 390" role="img" aria-labelledby="pareto-title pareto-desc">
        <title id="pareto-title">Conditional private-evidence Pareto frontier</title>
        <desc id="pareto-desc">Cost per benchmark case on the horizontal axis and conservative quality lower bound on the vertical axis.</desc>
        <line className="chart-axis" x1="70" y1="330" x2="735" y2="330" />
        <line className="chart-axis" x1="70" y1="330" x2="70" y2="50" />
        <line className="chart-gate" x1="70" y1={y(qualityFloor)} x2="735" y2={y(qualityFloor)} />
        {maximumCost != null ? <line className="chart-gate cost" x1={x(maximumCost)} y1="50" x2={x(maximumCost)} y2="330" /> : null}
        {frontier.length > 1 ? (
          <polyline
            className="chart-frontier"
            points={frontier.map((candidate) => `${x(candidate.average_cost_per_case ?? 0)},${y(candidate.quality_lower_bound)}`).join(" ")}
          />
        ) : null}
        {measured.map((candidate) => (
          <g key={`${candidate.candidate_type}:${candidate.candidate_id}`}>
            <circle
              className={`chart-point ${candidate.eligible ? "eligible" : "rejected"} ${candidate.pareto ? "frontier" : ""}`}
              cx={x(candidate.average_cost_per_case ?? 0)}
              cy={y(candidate.quality_lower_bound)}
              r={candidate.pareto ? 10 : 7}
            />
            <text x={x(candidate.average_cost_per_case ?? 0) + 13} y={y(candidate.quality_lower_bound) - 9}>
              {candidate.candidate_id.split("/").at(-1)}
            </text>
          </g>
        ))}
        <text className="axis-label" x="400" y="378">Mean cost per benchmark case →</text>
        <text className="axis-label vertical" x="-255" y="20">Conservative quality lower bound →</text>
        <text className="gate-label" x="80" y={y(qualityFloor) - 8}>QUALITY FLOOR {(qualityFloor * 100).toFixed(0)}%</text>
      </svg>
    </div>
  );
}
