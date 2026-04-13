import { Download, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import type { Layout, Data, PlotData } from "plotly.js";
import type { PlotParams } from "react-plotly.js";
import type { Route } from "./+types/home";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

const SAMPLE_CONFIG = {
  version: 3,
  dataframes: [
    {
      name: "Material Explorer",
      materials: [
        { material: "Aluminum 6061", family: "Metals", density: 2.7, modulus: 68, strength_low: 250, strength_high: 310 },
        { material: "Titanium Ti-6Al-4V", family: "Metals", density: 4.43, modulus: 114, strength_low: 830, strength_high: 900 },
        { material: "CFRP Laminate", family: "Composites", density: 1.55, modulus: 110, strength_low: 450, strength_high: 1200 },
        { material: "Nylon 6", family: "Polymers", density: 1.14, modulus: 2.8, strength_low: 60, strength_high: 90 },
        { material: "PEEK", family: "Polymers", density: 1.31, modulus: 4.2, strength_low: 90, strength_high: 110 },
      ],
      frames: [
        {
          name: "Specific Strength vs Specific Modulus",
          x: { key: "modulus", relative_to: "density" },
          y: { key: "strength", mode: "span", low_key: "strength_low", high_key: "strength_high", relative_to: "density" },
          layer: "family",
          material_label: "material",
          material_colors: {
            Metals: "#3b82f6",
            Composites: "#22c55e",
            Polymers: "#f97316",
          },
          dark_mode: false,
          log_x: true,
          log_y: true,
          show_legend: true,
          legend_position: "right",
          guidelines: [
            { type: "slope", x0: 10, y0: 100, slope: 1, color: "#64748b", text: "y = x" },
          ],
          colored_areas: [
            { name: "Polymer region", x: [1, 10, 10, 1], y: [10, 10, 100, 100], color: "rgba(249,115,22,0.12)" },
          ],
          annotations: [
            { x: 71.3, y: 774, text: "CFRP", color: "#166534" },
          ],
        },
      ],
    },
  ],
};

type Mode = "default" | "max" | "min" | "span";

type QuantityMap = {
  key: string;
  mode?: Mode;
  low_key?: string;
  high_key?: string;
  relative_to?: string;
};

type FrameConfig = {
  name?: string;
  x: QuantityMap;
  y: QuantityMap;
  layer: string;
  material_label?: string;
  material_colors?: Record<string, string | null>;
  default_color?: string;
  dark_mode?: boolean;
  log_x?: boolean;
  log_y?: boolean;
  show_legend?: boolean;
  legend_position?: "right" | "top";
  guidelines?: Array<{
    type: "vertical" | "horizontal" | "slope";
    x0?: number;
    y0?: number;
    slope?: number;
    color?: string;
    width?: number;
    text?: string;
  }>;
  colored_areas?: Array<{ name?: string; x: number[]; y: number[]; color?: string }>;
  annotations?: Array<{ x: number; y: number; text: string; color?: string }>;
};

type DataFrameConfig = {
  name?: string;
  materials: Array<Record<string, string | number | null>>;
  frames: FrameConfig[];
};

type AppConfig = {
  version: number;
  dataframes: DataFrameConfig[];
};

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Ashby Plot Studio" },
    { name: "description", content: "Client-side Ashby plot builder with Plotly.js" },
  ];
}

const asNumber = (v: unknown) => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const p = Number(v);
    return Number.isFinite(p) ? p : null;
  }
  return null;
};

function resolveQuantity(row: Record<string, string | number | null>, map: QuantityMap) {
  const pick = (key: string) => asNumber(row[key]);
  const mode = map.mode ?? "default";

  if (mode === "span") {
    const low = pick(map.low_key ?? `${map.key}_low`);
    const high = pick(map.high_key ?? `${map.key}_high`);
    if (low == null || high == null) return null;
    return { low, high, value: (low + high) / 2 };
  }

  const value = pick(map.key);
  if (value == null) return null;
  return { value, low: value, high: value };
}

export default function Home() {
  const [configText, setConfigText] = useState(() => JSON.stringify(SAMPLE_CONFIG, null, 2));
  const [selectedDf, setSelectedDf] = useState(0);
  const [selectedFrame, setSelectedFrame] = useState(0);
  const [Plot, setPlot] = useState<ComponentType<PlotParams> | null>(null);

  useEffect(() => {
    let alive = true;
    async function bootPlot() {
      const [{ default: createPlotlyComponent }, plotly] = await Promise.all([
        import("react-plotly.js/factory"),
        import("plotly.js-dist-min"),
      ]);
      if (alive) setPlot(() => createPlotlyComponent(plotly as any));
    }
    bootPlot().catch(() => setPlot(null));
    return () => {
      alive = false;
    };
  }, []);

  const parsed = useMemo(() => {
    try {
      return { config: JSON.parse(configText) as AppConfig, error: null };
    } catch (error) {
      return {
        config: null,
        error: error instanceof Error ? error.message : "Unknown parse error",
      };
    }
  }, [configText]);

  const renderPayload = useMemo(() => {
    if (!parsed.config) return { data: [] as Partial<PlotData>[], layout: {} as Partial<Layout>, errors: ["Invalid JSON."] };
    const errors: string[] = [];

    if (parsed.config.version !== 3) {
      errors.push(`Config version must be 3. Got ${parsed.config.version}.`);
      return { data: [], layout: {}, errors };
    }

    const dataframe = parsed.config.dataframes[selectedDf];
    if (!dataframe) {
      errors.push("Selected dataframe index does not exist.");
      return { data: [], layout: {}, errors };
    }

    const frame = dataframe.frames[selectedFrame];
    if (!frame) {
      errors.push("Selected frame index does not exist.");
      return { data: [], layout: {}, errors };
    }

    const groups = new Map<string, { x: number[]; y: number[]; text: string[]; color: string; lowY: number[]; highY: number[] }>();
    let skipped = 0;

    for (const row of dataframe.materials) {
      const layerKey = String(row[frame.layer] ?? "Ungrouped");
      const xRes = resolveQuantity(row, frame.x);
      const yRes = resolveQuantity(row, frame.y);
      if (!xRes || !yRes) {
        skipped += 1;
        continue;
      }

      let x = xRes.value;
      let y = yRes.value;
      let lowY = yRes.low;
      let highY = yRes.high;

      if (frame.x.relative_to) {
        const denom = asNumber(row[frame.x.relative_to]);
        if (!denom) {
          skipped += 1;
          continue;
        }
        x /= denom;
      }

      if (frame.y.relative_to) {
        const denom = asNumber(row[frame.y.relative_to]);
        if (!denom) {
          skipped += 1;
          continue;
        }
        y /= denom;
        lowY /= denom;
        highY /= denom;
      }

      const hidden = frame.material_colors?.[layerKey] === null;
      if (hidden) continue;

      const color = frame.material_colors?.[layerKey] ?? frame.default_color ?? "#0f172a";
      const label = String(row[frame.material_label ?? "material"] ?? layerKey);
      if (!groups.has(layerKey)) groups.set(layerKey, { x: [], y: [], text: [], color, lowY: [], highY: [] });
      const group = groups.get(layerKey)!;
      group.x.push(x);
      group.y.push(y);
      group.text.push(label);
      group.lowY.push(lowY);
      group.highY.push(highY);
    }

    const data: Partial<PlotData>[] = [];

    frame.colored_areas?.forEach((area) => {
      data.push({
        x: area.x,
        y: area.y,
        fill: "toself",
        mode: "lines",
        name: area.name ?? "Area",
        line: { color: "rgba(0,0,0,0)" },
        fillcolor: area.color ?? "rgba(59,130,246,0.15)",
        hoverinfo: "skip",
        showlegend: false,
      });
    });

    for (const [name, group] of groups) {
      data.push({
        type: "scatter",
        mode: "text+markers",
        x: group.x,
        y: group.y,
        text: group.text,
        textposition: "top center",
        name,
        marker: {
          size: 10,
          color: group.color,
          opacity: 0.85,
          line: { width: 1.25, color: "#fff" },
        },
        error_y: {
          type: "data",
          symmetric: false,
          array: group.highY.map((v, i) => Math.max(0, v - group.y[i]!)),
          arrayminus: group.lowY.map((v, i) => Math.max(0, group.y[i]! - v)),
          color: group.color,
          thickness: 1,
        },
      });
    }

    const dark = Boolean(frame.dark_mode);
    const axisColor = dark ? "#e2e8f0" : "#0f172a";
    const gridColor = dark ? "#334155" : "#cbd5e1";

    const shapes: NonNullable<Layout["shapes"]> = [];
    const annotations: NonNullable<Layout["annotations"]> = [];

    frame.guidelines?.forEach((line) => {
      if (line.type === "vertical" && line.x0 != null) {
        shapes.push({ type: "line", x0: line.x0, x1: line.x0, y0: 0, y1: 1, xref: "x", yref: "paper", line: { color: line.color ?? "#94a3b8", width: line.width ?? 1.5 } });
      }
      if (line.type === "horizontal" && line.y0 != null) {
        shapes.push({ type: "line", x0: 0, x1: 1, y0: line.y0, y1: line.y0, xref: "paper", yref: "y", line: { color: line.color ?? "#94a3b8", width: line.width ?? 1.5 } });
      }
      if (line.type === "slope" && line.x0 != null && line.y0 != null && line.slope != null) {
        const x1 = line.x0 * 5;
        const y1 = line.y0 * Math.pow(x1 / line.x0, line.slope);
        shapes.push({ type: "line", x0: line.x0, y0: line.y0, x1, y1, xref: "x", yref: "y", line: { color: line.color ?? "#64748b", width: line.width ?? 1.5, dash: "dot" } });
      }
      if (line.text && line.x0 != null && line.y0 != null) {
        annotations.push({ x: line.x0, y: line.y0, text: line.text, showarrow: false, font: { color: line.color ?? axisColor } });
      }
    });

    frame.annotations?.forEach((ann) => {
      annotations.push({ x: ann.x, y: ann.y, text: ann.text, showarrow: true, arrowhead: 2, ax: 22, ay: -22, font: { color: ann.color ?? axisColor } });
    });

    const layout: Partial<Layout> = {
      title: { text: frame.name ?? "Ashby Plot" },
      paper_bgcolor: dark ? "#020617" : "#ffffff",
      plot_bgcolor: dark ? "#020617" : "#ffffff",
      font: { color: axisColor, family: "Inter, system-ui, sans-serif", size: 13 },
      xaxis: {
        title: { text: frame.x.relative_to ? `${frame.x.key} / ${frame.x.relative_to}` : frame.x.key },
        type: frame.log_x ? "log" : "linear",
        gridcolor: gridColor,
        zeroline: false,
      },
      yaxis: {
        title: { text: frame.y.relative_to ? `${frame.y.key} / ${frame.y.relative_to}` : frame.y.key },
        type: frame.log_y ? "log" : "linear",
        gridcolor: gridColor,
        zeroline: false,
      },
      legend: {
        orientation: frame.legend_position === "top" ? "h" : "v",
        x: frame.legend_position === "top" ? 0 : 1.03,
        y: frame.legend_position === "top" ? 1.16 : 1,
      },
      showlegend: frame.show_legend ?? true,
      shapes,
      annotations,
      margin: { l: 80, r: 50, t: 70, b: 70 },
      hovermode: "closest",
    };

    if (data.length === 0) errors.push("Nothing could be plotted from the selected frame (all rows were filtered or invalid).");
    if (skipped > 0) errors.push(`Skipped ${skipped} row(s) due to missing/invalid numeric values.`);

    return { data, layout, errors };
  }, [parsed.config, selectedDf, selectedFrame]);

  const frameOptions = parsed.config?.dataframes[selectedDf]?.frames ?? [];

  const handleExport = async (format: "png" | "svg") => {
    const plotDiv = document.getElementById("ashby-plot") as HTMLDivElement | null;
    if (!plotDiv) return;
    const mod = await import("plotly.js-dist-min");
    const uri = await mod.default.toImage(plotDiv, { format, width: 1280, height: 820, scale: 2 });
    const a = document.createElement("a");
    a.href = uri;
    a.download = `ashby-plot.${format}`;
    a.click();
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[480px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ashby Plot Studio</CardTitle>
            <CardDescription>Build configurable Ashby plots entirely in the browser with Tailwind + shadcn + Plotly.js.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Config JSON</label>
              <textarea
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                className="h-[380px] w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-xs outline-none ring-slate-300 focus:ring"
              />
              {parsed.error ? <p className="mt-2 text-sm text-red-600">{parsed.error}</p> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Dataframe
                <select
                  value={selectedDf}
                  onChange={(e) => {
                    setSelectedDf(Number(e.target.value));
                    setSelectedFrame(0);
                  }}
                  className="mt-1 block h-9 w-full rounded-md border border-slate-300 bg-white px-2"
                >
                  {(parsed.config?.dataframes ?? []).map((df, i) => (
                    <option key={i} value={i}>
                      {i}: {df.name ?? `Dataframe ${i}`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium">
                Frame
                <select
                  value={selectedFrame}
                  onChange={(e) => setSelectedFrame(Number(e.target.value))}
                  className="mt-1 block h-9 w-full rounded-md border border-slate-300 bg-white px-2"
                >
                  {frameOptions.map((frame, i) => (
                    <option key={i} value={i}>
                      {i}: {frame.name ?? `Frame ${i}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setConfigText(JSON.stringify(SAMPLE_CONFIG, null, 2))}>
                <RefreshCw className="size-4" /> Reset sample
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => handleExport("png")}>
                <Download className="size-4" /> Export PNG
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => handleExport("svg")}>
                <Download className="size-4" /> Export SVG
              </Button>
            </div>

            {renderPayload.errors.length > 0 ? (
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700">
                {renderPayload.errors.map((err, i) => (
                  <li key={`${err}-${i}`}>{err}</li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Interactive client-side plot with legend toggles, hover labels, guideline/area overlays, and range error bars.</CardDescription>
          </CardHeader>
          <CardContent>
            {Plot ? (
              <Plot
                divId="ashby-plot"
                data={renderPayload.data as Data[]}
                layout={renderPayload.layout}
                config={{ responsive: true, displaylogo: false, scrollZoom: true }}
                style={{ width: "100%", height: "72vh" }}
                useResizeHandler
              />
            ) : (
              <div className="grid h-[72vh] place-items-center text-sm text-slate-500">Loading Plotly runtime…</div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
