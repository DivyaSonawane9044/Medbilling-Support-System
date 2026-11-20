import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./Analytics.css";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  BarChart3,
  Boxes,
  CalendarRange,
  IndianRupee,
  PiggyBank,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Warehouse,
} from "lucide-react";
import { PageHeader, LoadingSkeleton, ProgressBar, ChartCard, Avatar, DataTable, AnimatedButton } from "../components/ui";
import { analyticsAPI, handleApiError } from "../services/api";
import { CHART_COLORS, axisProps, gridProps, tooltipProps, inrShort, inrFull, chartAnimation, chartSurface } from "../utils/chartTheme";
import { withTimeout } from "./insights/useSections";
import SectionError from "./insights/SectionError";
import { num, money, units, parseDate } from "./insights/insightsUtils";

/** KPI tile in the StatCard look, with a static value (.an-kpi-value) and optional trend + hint together. */
function KpiTile({ icon: Icon, label, value, tone = "teal", trend, hint }) {
  return (
    <div className={`mb-stat mb-stat--${tone} an-kpi`}>
      <div className="mb-stat__top">
        <span className="mb-stat__label">{label}</span>
        <span className="mb-stat__icon" aria-hidden="true">
          <Icon size={20} />
        </span>
      </div>
      <div className="mb-stat__value an-kpi-value">{value}</div>
      {trend ? (
        <div className={`mb-stat__trend ${trend.value >= 0 ? "is-up" : "is-down"}`}>
          {trend.value >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          {Math.abs(trend.value).toFixed(1)}% <span>{trend.label}</span>
        </div>
      ) : null}
      {hint ? <div className="mb-stat__hint">{hint}</div> : null}
    </div>
  );
}

const PL_COLORS = { Profit: CHART_COLORS[0], Cost: CHART_COLORS[1] };

function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await withTimeout(analyticsAPI.getDashboard());
      setData(res.data || null);
    } catch (err) {
      setError(handleApiError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const anim = chartAnimation();
  const todayRevenue = num(data?.todayRevenue);
  const yesterdayRevenue = num(data?.yesterdayRevenue);
  const change = yesterdayRevenue > 0 ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100 : null;

  const series7d = useMemo(
    () =>
      (data?.salesTrend || []).map((p) => ({
        day: parseDate(p.date)?.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit" }) || p.date,
        sales: num(p.revenue),
      })),
    [data]
  );
  const hasSales = series7d.some((p) => p.sales > 0);
  const weekTotal = series7d.reduce((s, p) => s + p.sales, 0);

  const profitPie = useMemo(
    () =>
      (data?.profitLossPie || [])
        .map((s, i) => ({ name: s.name, value: num(s.value), color: PL_COLORS[s.name] || CHART_COLORS[(i + 2) % CHART_COLORS.length] }))
        .filter((s) => s.value > 0),
    [data]
  );
  const pieTotal = profitPie.reduce((s, p) => s + p.value, 0);
  const todayMargin = pieTotal > 0 ? (num(data?.profit) / pieTotal) * 100 : null;

  const bestSellers = useMemo(
    () =>
      (data?.bestSellingMedicines || []).map((m, i) => ({
        id: `${m.name}-${i}`,
        name: m.name || "Medicine",
        quantity: num(m.quantity),
        revenue: num(m.revenue),
      })),
    [data]
  );

  const monthlyRevenue = num(data?.monthlyRevenue);
  const topCustomers = useMemo(
    () =>
      (data?.topCustomers || []).map((c, i) => ({
        id: `${c.name}-${i}`,
        customer: c.name || "Unknown",
        amount: num(c.totalSpend),
      })),
    [data]
  );

  const mrp = num(data?.totalStockValueMrp);
  const cost = num(data?.totalStockValueCost);

  const header = (
    <PageHeader
      icon={BarChart3}
      eyebrow="Finance & insights"
      title="Analytics"
      subtitle="Sales trends, profit insights, best sellers and top customers"
      actions={
        <AnimatedButton icon={RefreshCw} onClick={load} disabled={loading} aria-label="Refresh">
          {loading ? "Refreshing..." : "Refresh"}
        </AnimatedButton>
      }
    />
  );

  if (loading && !data) {
    return (
      <div className="mb-page an">
        {header}
        <LoadingSkeleton variant="stats" rows={5} label="Loading analytics" />
        <div className="an-grid">
          <LoadingSkeleton variant="chart" label="Loading charts" />
          <LoadingSkeleton variant="chart" label="Loading charts" />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mb-page an">
        {header}
        <SectionError title="Could not load analytics" message={error} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="mb-page an">
      {header}

      {error && (
        <div className="ins-error" role="alert">
          <span>Could not refresh analytics: {error}. Showing the last loaded data.</span>
        </div>
      )}

      <section className="an-kpis mb-stagger" aria-label="Key figures">
        <KpiTile
          icon={IndianRupee}
          tone="mint"
          label="Today vs Yesterday"
          value={money(todayRevenue)}
          trend={change !== null ? { value: change, label: "vs yesterday" } : null}
          hint={`Yesterday: ${money(yesterdayRevenue)}`}
        />
        <KpiTile icon={CalendarRange} tone="teal" label="This Month Revenue" value={money(data?.monthlyRevenue)} hint="Invoice totals, GST included" />
        <KpiTile icon={PiggyBank} tone="lavender" label="This Month Profit" value={money(data?.monthlyProfit)} hint="Taxable value minus cost (GST excluded)" />
        <KpiTile icon={Warehouse} tone="navy" label="Stock Value (MRP)" value={money(mrp)} hint="Saleable stock at MRP" />
        <KpiTile icon={Boxes} tone="ice" label="Stock Value (Cost)" value={money(cost)} hint="Saleable stock at purchase cost" />
      </section>

      <div className="an-grid an-grid--wide">
        <ChartCard
          className="an-chart"
          title="Revenue Trend"
          subtitle={`Invoice totals per day, last 7 days · ${money(weekTotal)} in total`}
          empty={!hasSales}
          emptyText="No sales recorded in the last 7 days."
          height={270}
        >
          <ResponsiveContainer width="100%" height={270}>
            <AreaChart data={series7d} margin={{ top: 10, right: 24, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="anTrendFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={CHART_COLORS[0]} stopOpacity={0.28} />
                  <stop offset="1" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="day" {...axisProps} interval={0} />
              <YAxis {...axisProps} axisLine={false} width={64} tickFormatter={inrShort} />
              <Tooltip {...tooltipProps} cursor={{ stroke: CHART_COLORS[0], strokeDasharray: "4 4" }} formatter={(v) => [inrFull(v), "Sales"]} />
              <Area type="monotone" dataKey="sales" name="Sales" stroke={CHART_COLORS[0]} strokeWidth={2} fill="url(#anTrendFill)" activeDot={{ r: 5 }} {...anim} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          className="an-chart"
          title="Profit vs Cost (Today)"
          subtitle="Taxable value split into cost and profit, GST excluded"
          empty={profitPie.length === 0}
          emptyText="No profit or cost data for today yet."
          height={270}
        >
          <div className="an-donut">
            <div className="an-donut__chart">
              <ResponsiveContainer width="100%" height={190}>
                <PieChart>
                  <Tooltip {...tooltipProps} formatter={(v, n) => [inrFull(v), n]} />
                  <Pie data={profitPie} dataKey="value" nameKey="name" innerRadius={56} outerRadius={82} paddingAngle={2} stroke={chartSurface()} strokeWidth={2} {...anim}>
                    {profitPie.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="an-donut__center" aria-hidden="true">
                <strong>{todayMargin != null ? `${todayMargin.toFixed(1)}%` : "-"}</strong>
                <span>margin</span>
              </div>
            </div>
            <ul className="ins-legend" aria-label="Profit and cost today">
              {profitPie.map((s) => (
                <li key={s.name}>
                  <span className="ins-legend__dot" style={{ background: s.color }} />
                  <span className="ins-legend__name">{s.name}</span>
                  <span className="ins-legend__val">{money(s.value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>
      </div>

      <div className="an-grid">
        <ChartCard
          className="an-chart"
          title="Best Selling Medicines (This Month)"
          subtitle="Units sold"
          empty={bestSellers.length === 0}
          emptyText="No medicines sold this month yet."
          height={260}
        >
          <ResponsiveContainer width="100%" height={Math.max(200, bestSellers.length * 42 + 30)}>
            <BarChart data={bestSellers} layout="vertical" margin={{ top: 4, right: 18, bottom: 0, left: 0 }}>
              <CartesianGrid {...gridProps} vertical horizontal={false} />
              <XAxis type="number" {...axisProps} allowDecimals={false} />
              <YAxis
                type="category"
                dataKey="name"
                {...axisProps}
                width={130}
                interval={0}
                tickFormatter={(v) => (String(v).length > 18 ? `${String(v).slice(0, 17)}…` : v)}
              />
              <Tooltip {...tooltipProps} formatter={(v) => [`${units(v)} units`, "Units sold"]} />
              <Bar dataKey="quantity" name="Units sold" fill={CHART_COLORS[2]} radius={[0, 4, 4, 0]} maxBarSize={22} {...anim} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <section className="card ins-card an-stockvalue" aria-label="Stock value comparison">
          <div className="ins-card__head">
            <div className="ins-card__title">
              <span className="ins-card__icon ins-card__icon--navy" aria-hidden="true">
                <Scale size={18} />
              </span>
              <div>
                <h3>Stock Value: MRP vs Cost</h3>
                <p>What the saleable stock cost you and what it sells for at MRP</p>
              </div>
            </div>
          </div>
          {mrp <= 0 && cost <= 0 ? (
            <p className="ins-note">No saleable stock yet.</p>
          ) : (
            <>
              <div className="an-sv-row">
                <div className="an-sv-label">
                  <span>At MRP</span>
                  <strong>{money(mrp)}</strong>
                </div>
                <ProgressBar value={mrp} max={Math.max(mrp, cost)} tone="info" label="Stock value at MRP" />
              </div>
              <div className="an-sv-row">
                <div className="an-sv-label">
                  <span>At cost</span>
                  <strong>{money(cost)}</strong>
                </div>
                <ProgressBar value={cost} max={Math.max(mrp, cost)} tone="purple" label="Stock value at cost" />
              </div>
              <div className="an-sv-foot">
                <div>
                  <span>Difference (MRP - cost)</span>
                  <strong>{money(mrp - cost)}</strong>
                </div>
                <div>
                  <span>Cost as % of MRP</span>
                  <strong>{mrp > 0 ? `${((cost / mrp) * 100).toFixed(1)}%` : "-"}</strong>
                </div>
              </div>
              <p className="ins-note">MRP includes GST; the difference is the ceiling of gross margin before GST and discounts.</p>
            </>
          )}
        </section>
      </div>

      <div className="an-grid">
        <div className="an-table">
          <DataTable
            title="Best Sellers Revenue"
            subtitle="This month"
            columns={[
              { key: "name", header: "Medicine" },
              { key: "quantity", header: "Units", align: "right", cell: (v) => units(v) },
              { key: "revenue", header: "Revenue", align: "right", cell: (v) => money(v) },
            ]}
            rows={bestSellers}
            rowKey={(r) => r.id}
            searchable={false}
            initialPageSize={5}
          />
        </div>

        <div className="an-table">
          <DataTable
            title="Top Customers"
            subtitle="Highest purchase value this month · bar = share of this month's revenue"
            columns={[
              {
                key: "customer",
                header: "Customer",
                cell: (v) => (
                  <span className="an-cust">
                    <Avatar name={v} size={30} />
                    <span className="an-cust__name">{v}</span>
                  </span>
                ),
              },
              {
                key: "share",
                header: "Share",
                sortable: false,
                searchable: false,
                accessor: (r) => (monthlyRevenue > 0 ? r.amount / monthlyRevenue : 0),
                cell: (_, r) => (
                  <span className="an-share">
                    <ProgressBar value={r.amount} max={monthlyRevenue} tone="info" size="sm" label={`${r.customer}: share of this month's revenue`} />
                    <small>{monthlyRevenue > 0 ? `${Math.min(100, (r.amount / monthlyRevenue) * 100).toFixed(1)}%` : "-"}</small>
                  </span>
                ),
              },
              { key: "amount", header: "Total Spend", align: "right", cell: (v) => money(v) },
            ]}
            rows={topCustomers}
            rowKey={(r) => r.id}
            initialPageSize={10}
          />
        </div>
      </div>
    </div>
  );
}

export default Analytics;
