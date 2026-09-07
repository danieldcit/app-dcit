"use client";

import { useMemo, useState } from "react";

import styles from "./horas.module.css";

type HorasResumoItem = { userId: string; name: string; horasTrabalhadas: number; horasExtras: number; horasTickets: number };

const CHART_HEIGHT = 240;
const BAR_WIDTH = 50;
const BAR_GAP = 44;
const LABEL_HEIGHT = 34;

// A rotated label doesn't just reach left of its pivot — it also reaches
// *down* past it (rotate(-35, ...) on a text-anchor="end" string moves
// its start point down-and-left, not just left). `.chartScroll`'s
// `overflow-x: auto` was added in a previous fix round to handle wide
// (many-employee) charts, but CSS forces `overflow-y` to compute as
// `auto` too whenever `overflow-x` isn't `visible` and `overflow-y` is
// (an unavoidable coupling per the CSS Overflow spec — you cannot have
// "auto" on one axis and "visible" on the other on the same element).
// That silently clips anything that bleeds below the box's fixed height,
// which is exactly what a long rotated label does. Fix: make the box
// tall (and wide) enough that nothing needs to overflow in the first
// place — an "auto" overflow that never triggers is visually identical
// to "visible".
//
// The reserved margins used to be fixed constants sized for this app's
// dev-seed names (longest: "Daniel Gomes de Oliveira", 24 chars). Real
// names vary a lot more, so both margins are now derived from the
// longest employee name actually present in `data`. We don't have a
// live DOM node to measure (no effects/two-pass render in this
// component), so width is estimated from character count at the
// label's font-size: 10px — AVG_CHAR_WIDTH_PX is a deliberate
// upper-bound average for that size/font, so we overestimate margin
// rather than clip. From that estimated pixel width, the same trig the
// old fixed constants implicitly modeled gives the rotated (-25°)
// reach: vertical reach (bottom margin) ≈ textWidthPx * sin(25°),
// horizontal reach (left margin, shared with the y-axis tick numbers'
// own offset) ≈ textWidthPx * cos(25°). A shallower rotation than the
// original -35° trades a little horizontal room for a lot less vertical
// reach — the whole page has to fit one screen without scrolling, and
// vertical space is the scarcer budget here.
const AVG_CHAR_WIDTH_PX = 8.5;
const ROTATION_DEGREES = 25;
const ROTATION_RADIANS = (ROTATION_DEGREES * Math.PI) / 180;
const MARGIN_BUFFER_PX = 14;
const MIN_AXIS_LABEL_WIDTH = 64;
const MIN_LABEL_BOTTOM_MARGIN = 70;

function computeLabelMargins(names: string[]): { axisLabelWidth: number; labelBottomMargin: number } {
  const maxNameLength = names.reduce((max, name) => Math.max(max, name.length), 0);
  const textWidthPx = maxNameLength * AVG_CHAR_WIDTH_PX;
  const reachHorizontal = textWidthPx * Math.cos(ROTATION_RADIANS);
  const reachVertical = textWidthPx * Math.sin(ROTATION_RADIANS);
  return {
    axisLabelWidth: Math.max(MIN_AXIS_LABEL_WIDTH, Math.ceil(reachHorizontal + MARGIN_BUFFER_PX)),
    labelBottomMargin: Math.max(MIN_LABEL_BOTTOM_MARGIN, Math.ceil(reachVertical + MARGIN_BUFFER_PX)),
  };
}

// Rounds only the top two corners of a bar (square baseline) — a plain
// `rx` on a <rect> would round all four, which reads wrong for a bar that
// grows from a shared baseline (mark spec: "4px rounded data-end, square
// at the baseline"). radius 0 draws a plain rect — used for the bottom
// (Trabalhadas) segment of a stack when the Extras segment sits on top of
// it, since only whichever segment visually caps the stack gets rounded.
function roundedTopRectPath(x: number, y: number, width: number, height: number, radius: number): string {
  if (height <= 0) return "";
  const r = Math.min(radius, width / 2, height);
  return `M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`;
}

type SeriesKey = "trabalhadas" | "extras" | "tickets";

export function HorasChart({ data, metaTickets }: { data: HorasResumoItem[]; metaTickets?: number }) {
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>({
    trabalhadas: true,
    extras: true,
    tickets: true,
  });

  function toggleSeries(key: SeriesKey) {
    setVisibleSeries((current) => ({ ...current, [key]: !current[key] }));
  }

  // The scale stays fixed to the full underlying data (+ the meta line, if
  // any) regardless of which series is toggled off — recomputing it on
  // toggle would make the chart visibly jump/rescale every time a legend
  // item is clicked, which reads as broken rather than as "hiding a series".
  // Trabalhadas+Extras stack, so the bar's full height is their sum, not
  // either value alone.
  const maxValue = useMemo(() => {
    const allValues = data.flatMap((item) => [item.horasTrabalhadas + item.horasExtras, item.horasTickets]);
    if (metaTickets !== undefined) allValues.push(metaTickets);
    const max = Math.max(0, ...allValues);
    return max === 0 ? 10 : Math.ceil(max / 10) * 10;
  }, [data, metaTickets]);

  const { axisLabelWidth: AXIS_LABEL_WIDTH, labelBottomMargin: LABEL_BOTTOM_MARGIN } = useMemo(
    () => computeLabelMargins(data.map((item) => item.name)),
    [data],
  );

  if (data.length === 0) {
    return <p className={styles.empty}>Nenhum colaborador ativo.</p>;
  }

  const chartWidth = data.length * (BAR_WIDTH + BAR_GAP) + BAR_GAP;
  const plotHeight = CHART_HEIGHT - LABEL_HEIGHT;

  function scaleY(value: number): number {
    return plotHeight - (value / maxValue) * plotHeight;
  }

  const linePoints = data.map((item, index) => ({
    x: BAR_GAP + index * (BAR_WIDTH + BAR_GAP) + BAR_WIDTH / 2,
    y: scaleY(item.horasTickets),
    item,
  }));
  const linePath = linePoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");

  const yTicks = [0, maxValue / 2, maxValue];

  // Explicit pixel width/height (matching the viewBox 1:1) instead of the
  // CSS `width: 100%; height: auto` stretch this replaced: without an
  // intrinsic size, a viewBox-only <svg> stretched to a wide container
  // computes its height from the viewBox's aspect ratio, which — for a
  // narrow chart (few employees) — blows the height up to several times
  // the intended ~260px. Fixing the pixel size keeps height constant
  // regardless of employee count; the scrollable wrapper handles the
  // opposite edge (many employees making the chart wider than its card).
  const totalWidth = chartWidth + AXIS_LABEL_WIDTH;
  const totalHeight = CHART_HEIGHT + 20 + LABEL_BOTTOM_MARGIN;

  return (
    <div className={styles.chartWrapper}>
      <div className={styles.legend}>
        <button
          type="button"
          className={visibleSeries.trabalhadas ? styles.legendItem : `${styles.legendItem} ${styles.legendItemHidden}`}
          onClick={() => toggleSeries("trabalhadas")}
          aria-pressed={visibleSeries.trabalhadas}
        >
          <span className={`${styles.legendSwatch} ${styles.legendSwatchTrabalhadas}`} />
          Horas Trabalhadas
        </button>
        <button
          type="button"
          className={visibleSeries.extras ? styles.legendItem : `${styles.legendItem} ${styles.legendItemHidden}`}
          onClick={() => toggleSeries("extras")}
          aria-pressed={visibleSeries.extras}
        >
          <span className={`${styles.legendSwatch} ${styles.legendSwatchExtras}`} />
          Horas Extras
        </button>
        <button
          type="button"
          className={visibleSeries.tickets ? styles.legendItem : `${styles.legendItem} ${styles.legendItemHidden}`}
          onClick={() => toggleSeries("tickets")}
          aria-pressed={visibleSeries.tickets}
        >
          <span className={`${styles.legendSwatch} ${styles.legendSwatchTickets}`} />
          Horas em Tickets
        </button>
      </div>
      <div className={styles.chartScroll}>
        <svg
          viewBox={`0 -20 ${totalWidth} ${totalHeight}`}
          width={totalWidth}
          height={totalHeight}
          className={styles.chartSvg}
          role="img"
          aria-label="Gráfico de horas trabalhadas, horas extras e horas lançadas em tickets por colaborador"
        >
          <g transform={`translate(${AXIS_LABEL_WIDTH}, 0)`}>
            {yTicks.map((tick) => (
              <g key={tick}>
                <line x1={0} x2={chartWidth} y1={scaleY(tick)} y2={scaleY(tick)} className={styles.gridline} />
                <text x={-12} y={scaleY(tick)} textAnchor="end" dominantBaseline="middle" className={styles.axisLabel}>
                  {tick}
                </text>
              </g>
            ))}

            {data.map((item, index) => {
              const x = BAR_GAP + index * (BAR_WIDTH + BAR_GAP);
              const shownTrabalhadas = visibleSeries.trabalhadas ? item.horasTrabalhadas : 0;
              const shownExtras = visibleSeries.extras ? item.horasExtras : 0;
              const trabalhadasTopY = scaleY(shownTrabalhadas);
              const totalTopY = scaleY(shownTrabalhadas + shownExtras);
              const trabalhadasIsCap = shownExtras === 0;
              const isHovered = hoveredUserId === item.userId;
              return (
                <g
                  key={item.userId}
                  onMouseEnter={() => setHoveredUserId(item.userId)}
                  onMouseLeave={() => setHoveredUserId((current) => (current === item.userId ? null : current))}
                >
                  <rect x={x} y={0} width={BAR_WIDTH} height={plotHeight} fill="transparent" />
                  {shownTrabalhadas > 0 ? (
                    <path
                      d={roundedTopRectPath(x, trabalhadasTopY, BAR_WIDTH, plotHeight - trabalhadasTopY, trabalhadasIsCap ? 6 : 0)}
                      className={styles.bar}
                    />
                  ) : null}
                  {shownExtras > 0 ? (
                    <path
                      d={roundedTopRectPath(x, totalTopY, BAR_WIDTH, trabalhadasTopY - totalTopY, 6)}
                      className={styles.barExtra}
                    />
                  ) : null}
                  {shownTrabalhadas + shownExtras > 0 ? (
                    <text x={x + BAR_WIDTH / 2} y={totalTopY - 8} textAnchor="middle" className={styles.barValueLabel}>
                      {shownTrabalhadas + shownExtras}
                    </text>
                  ) : null}
                  {shownExtras > 0 ? (
                    <text x={x + BAR_WIDTH / 2} y={trabalhadasTopY - 8} textAnchor="middle" className={styles.barExtraValueLabel}>
                      +{shownExtras}
                    </text>
                  ) : null}
                  <text
                    x={x + BAR_WIDTH / 2}
                    y={plotHeight + 20}
                    textAnchor="end"
                    className={styles.employeeLabel}
                    transform={`rotate(-${ROTATION_DEGREES}, ${x + BAR_WIDTH / 2}, ${plotHeight + 20})`}
                  >
                    {item.name}
                  </text>
                  {isHovered ? (
                    <text x={x + BAR_WIDTH / 2} y={plotHeight + 40} textAnchor="middle" className={styles.tooltip}>
                      {item.horasTrabalhadas}h trabalhadas
                      {item.horasExtras > 0 ? ` · ${item.horasExtras}h extras` : ""} · {item.horasTickets}h em tickets
                    </text>
                  ) : null}
                </g>
              );
            })}

            {visibleSeries.tickets ? (
              <>
                <path d={linePath} className={styles.line} fill="none" />
                {linePoints.map((point) => (
                  <circle key={point.item.userId} cx={point.x} cy={point.y} r={7} className={styles.marker} />
                ))}
                {linePoints.map((point) => (
                  <text key={point.item.userId} x={point.x} y={point.y - 14} textAnchor="middle" className={styles.lineValueLabel}>
                    {point.item.horasTickets}
                  </text>
                ))}
              </>
            ) : null}

            {metaTickets !== undefined ? (
              <g>
                <line
                  x1={0}
                  x2={chartWidth}
                  y1={scaleY(metaTickets)}
                  y2={scaleY(metaTickets)}
                  className={styles.metaLine}
                />
                <text x={chartWidth} y={scaleY(metaTickets) - 8} textAnchor="end" className={styles.metaLabel}>
                  Meta: {metaTickets}h em tickets
                </text>
              </g>
            ) : null}
          </g>
        </svg>
      </div>
    </div>
  );
}
