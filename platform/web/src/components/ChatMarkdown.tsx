import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import remarkGfm from "remark-gfm";

export type ChatMarkdownVariant = "assistant" | "user";

type ChartSpec = {
  v?: number;
  kind?: string;
  type?: string;
  title?: string;
  xKey: string;
  yKey: string;
  data: Array<Record<string, unknown>>;
};

function parseChartSpec(raw: string): ChartSpec | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const o = JSON.parse(t) as ChartSpec;
    if (!o || !Array.isArray(o.data) || typeof o.xKey !== "string" || typeof o.yKey !== "string") return null;
    if (o.data.length === 0) return null;
    return o;
  } catch {
    return null;
  }
}

function kindOf(spec: ChartSpec): string {
  return String(spec.kind || spec.type || "bar").toLowerCase();
}

function ChartFromSpec({ spec }: { spec: ChartSpec }) {
  const { data, xKey, yKey, title } = spec;
  const k = kindOf(spec);
  const rows = data.map((row) => {
    const yv = row[yKey];
    const n = typeof yv === "number" ? yv : Number(yv);
    return { ...row, [yKey]: Number.isFinite(n) ? n : 0 } as Record<string, unknown>;
  });
  if (k === "line") {
    return (
      <div className="ai-assistant-chart-wrap">
        {title ? <div className="ai-assistant-chart-title">{title}</div> : null}
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={rows} margin={{ top: 6, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="var(--text-low)" />
            <YAxis tick={{ fontSize: 11 }} stroke="var(--text-low)" width={40} />
            <Tooltip
              contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6 }}
            />
            <Line type="monotone" dataKey={yKey} stroke="var(--accent)" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  return (
    <div className="ai-assistant-chart-wrap">
      {title ? <div className="ai-assistant-chart-title">{title}</div> : null}
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={rows} margin={{ top: 6, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11 }} stroke="var(--text-low)" />
          <YAxis tick={{ fontSize: 11 }} stroke="var(--text-low)" width={40} />
          <Tooltip
            contentStyle={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: 6 }}
          />
          <Bar dataKey={yKey} fill="var(--accent)" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function makeComponents(): Partial<Components> {
  return {
    pre: ({ children }: { children?: ReactNode }) => (
      <div className="ai-assistant-fence-wrap">{children}</div>
    ),
    code: (props) => {
      const { className, children, ...rest } = props;
      const raw = String(children).replace(/\n$/, "");
      if (className?.includes("language-chart")) {
        const sp = parseChartSpec(raw);
        if (sp) return <ChartFromSpec spec={sp} />;
        return <div className="ai-assistant-chart-err">Could not render chart. Expect JSON with xKey, yKey, and data.</div>;
      }
      if (!className) {
        return (
          <code className="ai-assistant-md-inline" {...rest}>
            {children}
          </code>
        );
      }
      return (
        <code className={className + " ai-assistant-md-blockcode"} {...rest}>
          {children}
        </code>
      );
    },
  };
}

const mdComponents = makeComponents();

export function ChatMarkdown({ text, variant = "assistant" }: { text: string; variant?: ChatMarkdownVariant }) {
  return (
    <div className={variant === "user" ? "ai-assistant-md ai-assistant-md--user" : "ai-assistant-md"}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
