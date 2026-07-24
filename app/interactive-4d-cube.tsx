"use client";

import { useMemo, useRef, useState } from "react";

export type WorkloadId =
  | "realtime"
  | "interactive"
  | "delegated"
  | "batch"
  | "continuous";

type Point3D = { x: number; y: number; z: number };
type Point2D = { x: number; y: number; depth: number };

type Lens = {
  id: WorkloadId;
  label: string;
  primary: string;
  gates: string;
  axis: "cost" | "time" | "score";
  limits: Record<"cost" | "time" | "evidence", Limit>;
  scoreFloor: ScoreFloor;
};

type Limit = "Open" | "Balanced" | "Tight";
type ScoreFloor = "Open" | "High" | "Strict";

const LENSES: Lens[] = [
  { id: "realtime", label: "Real-time", primary: "Latency", gates: "Quality · Cost · Evidence", axis: "time", limits: { cost: "Balanced", time: "Tight", evidence: "Balanced" }, scoreFloor: "High" },
  { id: "interactive", label: "Coding", primary: "Time to accepted result", gates: "Quality · Cost · Evidence", axis: "time", limits: { cost: "Open", time: "Balanced", evidence: "Balanced" }, scoreFloor: "High" },
  { id: "delegated", label: "Long horizon", primary: "Cost / success", gates: "Quality · Latency · Evidence", axis: "cost", limits: { cost: "Tight", time: "Open", evidence: "Tight" }, scoreFloor: "High" },
  { id: "batch", label: "Batch", primary: "Unit cost", gates: "Quality · Latency · Evidence", axis: "cost", limits: { cost: "Tight", time: "Open", evidence: "Balanced" }, scoreFloor: "High" },
  { id: "continuous", label: "Recurring", primary: "Reliability", gates: "Cost · Latency · Evidence", axis: "score", limits: { cost: "Balanced", time: "Open", evidence: "Tight" }, scoreFloor: "Strict" },
];

const SCORE_FLOORS: ScoreFloor[] = ["Open", "High", "Strict"];
const LIMITS: Limit[] = ["Open", "Balanced", "Tight"];
const LIMIT_SCALE: Record<Limit, number> = { Open: .92, Balanced: .7, Tight: .48 };

const VERTICES: Point3D[] = [
  { x: -1, y: -1, z: -1 },
  { x: 1, y: -1, z: -1 },
  { x: -1, y: 1, z: -1 },
  { x: 1, y: 1, z: -1 },
  { x: -1, y: -1, z: 1 },
  { x: 1, y: -1, z: 1 },
  { x: -1, y: 1, z: 1 },
  { x: 1, y: 1, z: 1 },
];

const EDGES: Array<[number, number, "cost" | "time" | "evidence"]> = [
  [0, 1, "cost"], [2, 3, "cost"], [4, 5, "cost"], [6, 7, "cost"],
  [0, 2, "time"], [1, 3, "time"], [4, 6, "time"], [5, 7, "time"],
  [0, 4, "evidence"], [1, 5, "evidence"], [2, 6, "evidence"], [3, 7, "evidence"],
];

const FACES: number[][] = [
  [0, 1, 3, 2],
  [4, 5, 7, 6],
  [0, 1, 5, 4],
  [2, 3, 7, 6],
  [0, 2, 6, 4],
  [1, 3, 7, 5],
];

const AXIS_COLORS = {
  cost: "#c96f4d",
  time: "#a98234",
  evidence: "#69597b",
  score: "#3f7766",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function project(point: Point3D, yaw: number, pitch: number): Point2D {
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const rotatedX = point.x * cosYaw + point.z * sinYaw;
  const yawDepth = -point.x * sinYaw + point.z * cosYaw;
  const rotatedY = point.y * cosPitch - yawDepth * sinPitch;
  const depth = point.y * sinPitch + yawDepth * cosPitch;
  const perspective = 1 / (1 + depth * 0.13);
  return {
    x: 356 + rotatedX * 126 * perspective,
    y: 248 - rotatedY * 126 * perspective,
    depth,
  };
}

function planeLines(axis: "x" | "y" | "z", position: number) {
  const values = [-0.5, 0, 0.5];
  const lines: Array<[Point3D, Point3D]> = [];
  values.forEach((value) => {
    if (axis === "x") {
      lines.push([{ x: position, y: -1, z: value }, { x: position, y: 1, z: value }]);
      lines.push([{ x: position, y: value, z: -1 }, { x: position, y: value, z: 1 }]);
    } else if (axis === "y") {
      lines.push([{ x: -1, y: position, z: value }, { x: 1, y: position, z: value }]);
      lines.push([{ x: value, y: position, z: -1 }, { x: value, y: position, z: 1 }]);
    } else {
      lines.push([{ x: -1, y: value, z: position }, { x: 1, y: value, z: position }]);
      lines.push([{ x: value, y: -1, z: position }, { x: value, y: 1, z: position }]);
    }
  });
  return lines;
}

function ScoreGlyph({ floor }: { floor: ScoreFloor }) {
  const size = floor === "Open" ? 7 : floor === "High" ? 11 : 15;
  return (
    <span className="cube-score-glyph" aria-hidden="true">
      <i style={{ width: size, height: size }} />
    </span>
  );
}

export default function Interactive4DCube({
  workloadId,
  onWorkloadChange,
}: {
  workloadId: WorkloadId;
  onWorkloadChange: (id: WorkloadId) => void;
}) {
  const [yaw, setYaw] = useState(-0.58);
  const [pitch, setPitch] = useState(0.42);
  const [scoreFloor, setScoreFloor] = useState<ScoreFloor>("High");
  const [limits, setLimits] = useState<Record<"cost" | "time" | "evidence", Limit>>({ cost: "Open", time: "Balanced", evidence: "Balanced" });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; yaw: number; pitch: number } | null>(null);
  const lens = LENSES.find((item) => item.id === workloadId) ?? LENSES[1];

  const geometry = useMemo(() => {
    const points = VERTICES.map((point) => project(point, yaw, pitch));
    const faces = FACES.map((face) => ({
      face,
      depth: face.reduce((sum, index) => sum + points[index].depth, 0) / face.length,
    })).sort((a, b) => b.depth - a.depth);
    const grid = [
      ...planeLines("x", -1),
      ...planeLines("y", -1),
      ...planeLines("z", -1),
    ].map(([from, to]) => [project(from, yaw, pitch), project(to, yaw, pitch)] as const);
    const envelope = VERTICES.map((point) => project({
      x: point.x * LIMIT_SCALE[limits.cost],
      y: point.y * LIMIT_SCALE[limits.time],
      z: point.z * LIMIT_SCALE[limits.evidence],
    }, yaw, pitch));
    return { points, faces, grid, envelope };
  }, [limits, pitch, yaw]);

  const resetView = () => {
    setYaw(-0.58);
    setPitch(0.42);
  };

  const cycleLimit = (key: "cost" | "time" | "evidence") => {
    setLimits((current) => {
      const index = LIMITS.indexOf(current[key]);
      return { ...current, [key]: LIMITS[(index + 1) % LIMITS.length] };
    });
  };

  const chooseWorkload = (next: Lens) => {
    onWorkloadChange(next.id);
    setLimits(next.limits);
    setScoreFloor(next.scoreFloor);
  };

  return (
    <section className="decision-cube" aria-label="Interactive four-dimensional decision space">
      <div className="decision-cube-head">
        <div>
          <span>4D decision space</span>
          <b>Cost × latency × evidence confidence × quality</b>
        </div>
        <button type="button" onClick={resetView}>Reset view</button>
      </div>

      <div className="cube-axis-map" aria-label="Four decision dimensions">
        <button type="button" onClick={() => cycleLimit("cost")}><i style={{ background: AXIS_COLORS.cost }} /><span><b>X · Cost</b><small>Ceiling: {limits.cost}</small></span></button>
        <button type="button" onClick={() => cycleLimit("time")}><i style={{ background: AXIS_COLORS.time }} /><span><b>Y · Latency</b><small>Ceiling: {limits.time}</small></span></button>
        <button type="button" onClick={() => cycleLimit("evidence")}><i style={{ background: AXIS_COLORS.evidence }} /><span><b>Z · Evidence</b><small>Floor: {limits.evidence}</small></span></button>
        <div><i className="score-gradient" /><span><b>4th · Quality</b><small>Benchmark floor: {scoreFloor}</small></span></div>
      </div>

      <div
        className="decision-cube-stage"
        data-dragging={dragging ? "true" : "false"}
        role="application"
        tabIndex={0}
        aria-label="Drag to rotate the cube. Use arrow keys to rotate it."
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, yaw, pitch };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (!drag.current || drag.current.pointerId !== event.pointerId) return;
          setYaw(drag.current.yaw + (event.clientX - drag.current.x) * 0.008);
          setPitch(clamp(drag.current.pitch + (event.clientY - drag.current.y) * 0.007, -0.85, 0.85));
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointerId === event.pointerId) drag.current = null;
          setDragging(false);
        }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
        onDoubleClick={resetView}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") setYaw((value) => value - 0.12);
          if (event.key === "ArrowRight") setYaw((value) => value + 0.12);
          if (event.key === "ArrowUp") setPitch((value) => clamp(value - 0.1, -0.85, 0.85));
          if (event.key === "ArrowDown") setPitch((value) => clamp(value + 0.1, -0.85, 0.85));
          if (event.key.startsWith("Arrow")) event.preventDefault();
        }}
      >
        <div className="cube-drag-hint" aria-hidden="true"><i /> Drag to rotate</div>
        <div className="cube-score-rail" aria-label="Score floor">
          <span>Benchmark score</span>
          {SCORE_FLOORS.map((floor) => (
            <button
              type="button"
              className={scoreFloor === floor ? "active" : ""}
              aria-pressed={scoreFloor === floor}
              key={floor}
              onClick={(event) => {
                event.stopPropagation();
                setScoreFloor(floor);
              }}
            >
              <ScoreGlyph floor={floor} />
              {floor}
            </button>
          ))}
        </div>
        <svg viewBox="0 0 720 510" role="img" aria-label={`Cost, latency, and evidence axes with benchmark quality encoded by color at a ${scoreFloor.toLowerCase()} floor`}>
          <defs>
            <radialGradient id="cube-focus" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor={AXIS_COLORS[lens.axis]} stopOpacity=".38" />
              <stop offset="1" stopColor={AXIS_COLORS[lens.axis]} stopOpacity="0" />
            </radialGradient>
          </defs>

          {geometry.faces.map(({ face, depth }, index) => (
            <polygon
              key={`${face.join("-")}-${index}`}
              points={face.map((vertex) => `${geometry.points[vertex].x},${geometry.points[vertex].y}`).join(" ")}
              fill={depth > 0 ? "#eef2e9" : "#fbfcf8"}
              fillOpacity={scoreFloor === "Strict" ? .34 : scoreFloor === "High" ? .25 : .18}
              stroke="none"
            />
          ))}

          {geometry.grid.map(([from, to], index) => (
            <line key={index} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="cube-grid-line" />
          ))}

          {EDGES.map(([fromIndex, toIndex, axis]) => {
            const from = geometry.points[fromIndex];
            const to = geometry.points[toIndex];
            const active = lens.axis === axis;
            return (
              <line
                key={`${fromIndex}-${toIndex}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={active ? AXIS_COLORS[axis] : "#607068"}
                strokeWidth={active ? 3.2 : 1.35}
                strokeOpacity={active ? .96 : .54}
                strokeLinecap="round"
              />
            );
          })}

          <g className="cube-score-envelope" aria-hidden="true">
            {EDGES.map(([fromIndex, toIndex]) => {
              const from = geometry.envelope[fromIndex];
              const to = geometry.envelope[toIndex];
              return (
                <line
                  key={`score-${fromIndex}-${toIndex}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke={AXIS_COLORS.score}
                  strokeWidth="1.7"
                  strokeOpacity=".78"
                  strokeDasharray="5 6"
                />
              );
            })}
          </g>

          {(() => {
            const preferred = project({ x: -LIMIT_SCALE[limits.cost], y: -LIMIT_SCALE[limits.time], z: -LIMIT_SCALE[limits.evidence] }, yaw, pitch);
            const halo = scoreFloor === "Strict" ? 54 : scoreFloor === "High" ? 43 : 34;
            return (
              <g>
                <circle cx={preferred.x} cy={preferred.y} r={halo} fill="url(#cube-focus)" />
                <circle cx={preferred.x} cy={preferred.y} r="8" fill={AXIS_COLORS[lens.axis]} stroke="#fbfcf8" strokeWidth="4" />
                <text x={preferred.x + 17} y={preferred.y - 14} className="cube-region-label">eligible space</text>
              </g>
            );
          })()}

          {(() => {
            const origin = project({ x: -1.18, y: -1.16, z: -1.08 }, yaw, pitch);
            const cost = project({ x: 1.34, y: -1.16, z: -1.08 }, yaw, pitch);
            const time = project({ x: -1.18, y: 1.34, z: -1.08 }, yaw, pitch);
            const evidence = project({ x: -1.18, y: -1.16, z: 1.34 }, yaw, pitch);
            return (
              <g>
                <line x1={origin.x} y1={origin.y} x2={cost.x} y2={cost.y} className="cube-axis" stroke={AXIS_COLORS.cost} />
                <line x1={origin.x} y1={origin.y} x2={time.x} y2={time.y} className="cube-axis" stroke={AXIS_COLORS.time} />
                <line x1={origin.x} y1={origin.y} x2={evidence.x} y2={evidence.y} className="cube-axis" stroke={AXIS_COLORS.evidence} />
                <text x={cost.x + 8} y={cost.y + 4} className="cube-axis-label" fill={AXIS_COLORS.cost}>X · COST</text>
                <text x={time.x - 4} y={time.y - 10} textAnchor="middle" className="cube-axis-label" fill={AXIS_COLORS.time}>Y · LATENCY</text>
                <text x={evidence.x + 9} y={evidence.y + 4} className="cube-axis-label" fill={AXIS_COLORS.evidence}>Z · EVIDENCE</text>
              </g>
            );
          })()}
        </svg>
      </div>

      <div className="decision-cube-workloads" role="group" aria-label="Workload lens">
        {LENSES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={workloadId === item.id ? "active" : ""}
            aria-pressed={workloadId === item.id}
            onClick={() => chooseWorkload(item)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="decision-cube-readout" aria-live="polite">
        <span><b>Optimize</b>{lens.primary}</span>
        <span><b>Gate</b>{lens.gates}</span>
        <span><b>Benchmark score</b>{scoreFloor}</span>
      </div>
    </section>
  );
}
