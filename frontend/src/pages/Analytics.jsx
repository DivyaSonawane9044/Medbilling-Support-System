import React, { useMemo } from "react";
import "./Analytics.css";
import Badge from "../components/ui/Badge";
import DataTable from "../components/ui/DataTable";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TrendingUp } from "lucide-react";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function dayKey(d) {
  return d.toISOString().slice(0, 10);
}

function Analytics() {
  const bills = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("rp_bills") || "[]");
    } catch {
      return [];
    }
  }, []);

  const today = useMemo(() => new Date(), []);
  const yesterday = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }, []);

  const totalsToday = useMemo(() => {
    const k = dayKey(today);
    return bills.filter((b) => dayKey(new Date(b.createdAt)) === k).reduce((s, b) => s + (b.totals?.grand || 0), 0);
  }, [bills, today]);

  const totalsYesterday = useMemo(() => {
    const k = dayKey(yesterday);
    return bills.filter((b) => dayKey(new Date(b.createdAt)) === k).reduce((s, b) => s + (b.totals?.grand || 0), 0);
  }, [bills, yesterday]);

  const series7d = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      const total = bills.filter((b) => dayKey(new Date(b.createdAt)) === k).reduce((s, b) => s + (b.totals?.grand || 0), 0);
      days.push({ day: d.toLocaleDateString("en-IN", { weekday: "short" }), sales: Math.round(total) });
    }
    return days;
  }, [bills]);

  const profitExpense = useMemo(() => {
    // Mock accounting: assume 25% gross margin for now.
    return series7d.map((d) => ({
      day: d.day,
      profit: Math.round(d.sales * 0.25),
      expense: Math.round(d.sales * 0.75),
    }));
  }, [series7d]);

  const topCustomers = useMemo(() => {
    const map = new Map();
    for (const b of bills) {
      const name = (b.customerName || "Unknown").trim() || "Unknown";
      map.set(name, (map.get(name) || 0) + (b.totals?.grand || 0));
    }
    return [...map.entries()]
      .map(([customer, amount]) => ({ customer, amount: Math.round(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);
  }, [bills]);

  return (
    <div className="an">
      <div className="an-head">
        <div>
          <h2 className="an-title">Analytics</h2>
          <p className="an-subtitle">Sales trends, profit insights, and top customers</p>
        </div>
        <div className="an-kpis">
          <div className="card an-kpi">
            <div className="an-kpi-label">Today vs Yesterday</div>
            <div className="an-kpi-value">{INR.format(totalsToday)}</div>
            <div className="an-kpi-sub">
              <Badge tone="blue">
                <TrendingUp size={14} /> {totalsYesterday === 0 ? "—" : `${Math.round(((totalsToday - totalsYesterday) / totalsYesterday) * 100)}%`}
              </Badge>
              <span className="muted">Yesterday: {INR.format(totalsYesterday)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="an-grid">
        <div className="card an-chart">
          <div className="card-head">
            <h3>Sales (Last 7 Days)</h3>
            <p>Based on saved bills</p>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={series7d} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="day" stroke="#64748B" tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => INR.format(v)} />
                <Line type="monotone" dataKey="sales" stroke="#3B82F6" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card an-chart">
          <div className="card-head">
            <h3>Profit vs Expense (Mock)</h3>
            <p>Assumes 25% gross margin for now</p>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={profitExpense} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="day" stroke="#64748B" tickLine={false} axisLine={false} />
                <YAxis stroke="#64748B" tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => INR.format(v)} />
                <Legend />
                <Bar dataKey="profit" name="Profit" fill="#10B981" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#3B82F6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <DataTable
          title="Top Customers"
          subtitle="Highest purchase value"
          columns={[
            { key: "customer", header: "Customer" },
            { key: "amount", header: "Amount", align: "right", cell: (v) => INR.format(v) },
          ]}
          rows={topCustomers}
          rowKey={(r) => r.customer}
          initialPageSize={10}
        />
      </div>
    </div>
  );
}

export default Analytics;

