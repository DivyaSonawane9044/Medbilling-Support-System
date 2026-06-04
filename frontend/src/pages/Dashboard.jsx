import React, { useMemo, useState, useEffect } from "react";
import "./Dashboard.css";
import {
  Area,
  AreaChart,
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
  Bell,
  CirclePlus,
  Clock3,
  CreditCard,
  FileText,
  IndianRupee,
  Pill,
  Search,
  ShieldCheck,
  TriangleAlert,
  TrendingDown,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import DataTable from "../components/ui/DataTable";
import { analyticsAPI, inventoryAPI, productsAPI, handleApiError } from "../services/api";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function formatDateLong(d) {
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function Trend({ value }) {
  const isUp = value >= 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span className={`trend ${isUp ? "trend-up" : "trend-down"}`}>
      <Icon size={14} />
      <span>{Math.abs(value)}%</span>
    </span>
  );
}

const inventoryColumns = [
  { key: "name", header: "Medicine" },
  { key: "company", header: "Company", cell: (value) => value || "Unknown" },
  { key: "genericName", header: "Generic Name", cell: (value) => value || "-" },
  { key: "dosageForm", header: "Dosage", cell: (value) => value || "-" },
  { key: "unitType", header: "Unit", cell: (value) => value || "-" },
  { key: "quantity", header: "Qty", align: "right" },
  {
    key: "price",
    header: "Price",
    align: "right",
    cell: (value) => (value != null ? `₹${Number(value).toFixed(2)}` : "-"),
  },
  {
    key: "expiryDate",
    header: "Expiry",
    cell: (value) => (value ? new Date(value).toLocaleDateString("en-IN") : "N/A"),
  },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  
  // State for API data
  const [dashboardData, setDashboardData] = useState(null);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [nearExpiryItems, setNearExpiryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const notificationCount = useMemo(
    () => Math.min(8, stockAlerts.length + nearExpiryItems.length),
    [stockAlerts, nearExpiryItems]
  );

  const dashboardNotifications = useMemo(() => {
    const alerts = [];

    stockAlerts.slice(0, 3).forEach((item) => {
      const expiryDate = item.expiryDate || item.product?.expiryDate;
      const quantity = item.quantity ?? item.product?.quantity ?? 0;
      alerts.push({
        type: "Low stock",
        title: item.name || item.product?.name || "Unknown product",
        subtitle: `${quantity} units available`,
        detail: expiryDate ? `Expires ${formatDateLong(new Date(expiryDate))}` : "",
      });
    });

    nearExpiryItems.slice(0, 3).forEach((item) => {
      const batchExpiry = item.expiryDate || item.product?.expiryDate;
      const quantity = item.product?.quantity ?? item.stripStock ?? item.tabletStock ?? 0;
      alerts.push({
        type: "Expiry soon",
        title: item.product?.name || item.product?.genericName || "Near expiry item",
        subtitle: `${quantity} units available`,
        detail: batchExpiry ? `Expires ${formatDateLong(new Date(batchExpiry))}` : "",
      });
    });

    if (alerts.length === 0) {
      alerts.push({ type: "Healthy", title: "Inventory looks good", subtitle: "No alerts right now.", detail: "All tracked medications are within safe stock and expiry ranges." });
    }

    return alerts;
  }, [stockAlerts, nearExpiryItems]);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        setSearchLoading(true);
        const searchText = searchQuery.trim();
        const response = await productsAPI.getAll(searchText || undefined);
        if (cancelled) return;
        const data = response.data?.content ?? response.data ?? [];
        setSearchResults(data || []);
        setSearchError(null);
      } catch (err) {
        if (!cancelled) setSearchError(handleApiError(err).message);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [searchQuery]);

  // Fetch dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [dashboardResponse, alertsResponse, expiryResponse] = await Promise.all([
          analyticsAPI.getDashboard(),
          analyticsAPI.getStockAlerts(),
          inventoryAPI.getNearExpiry()
        ]);

        setDashboardData(dashboardResponse.data);
        setStockAlerts(alertsResponse.data);
        setNearExpiryItems(expiryResponse.data);
      } catch (err) {
        setError(handleApiError(err).message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // KPIs derived from API data
  const kpis = useMemo(() => {
    if (!dashboardData) return [];
    
    return [
      {
        title: "Today's Revenue",
        value: dashboardData.todayRevenue || 0,
        helper: "Daily revenue",
        icon: IndianRupee,
        accent: "green",
        trend: dashboardData.yesterdayRevenue && Number(dashboardData.yesterdayRevenue) > 0
          ? Math.round(((Number(dashboardData.todayRevenue) - Number(dashboardData.yesterdayRevenue)) / Number(dashboardData.yesterdayRevenue)) * 100)
          : 0,
        valueFormatter: (v) => INR.format(v),
      },
      {
        title: "Low Stock Medicines",
        value: dashboardData.lowStockCount || 0,
        helper: "Below reorder level",
        icon: TriangleAlert,
        accent: "amber",
        trend: -2.1,
      },
      {
        title: "Expiring Soon",
        value: dashboardData.nearExpiryCount || 0,
        helper: "Expiry within 60 days",
        icon: Clock3,
        accent: "purple",
        trend: 1.6,
      },
      {
        title: "Monthly Profit",
        value: dashboardData.profit || 0,
        helper: "Monthly profit",
        icon: Pill,
        accent: "blue",
        trend: 4.2,
        valueFormatter: (v) => INR.format(v),
      },
    ];
  }, [dashboardData]);

  const sales7d = useMemo(() => {
    if (!dashboardData?.salesTrend?.length) return [];
    return dashboardData.salesTrend.map((p) => ({
      day: new Date(p.date).toLocaleDateString("en-IN", { weekday: "short" }),
      sales: Number(p.revenue) || 0,
    }));
  }, [dashboardData]);

  const profitLossData = useMemo(() => {
    if (!dashboardData?.profitLossPie?.length) {
      return [
        { name: "Profit", value: Number(dashboardData?.profit) || 0, color: "#10B981" },
        { name: "Cost", value: Number(dashboardData?.totalCost) || 0, color: "#EF4444" },
      ];
    }
    const colors = { Profit: "#10B981", Cost: "#EF4444" };
    return dashboardData.profitLossPie.map((s) => ({
      name: s.name,
      value: Number(s.value) || 0,
      color: colors[s.name] || "#3B82F6",
    }));
  }, [dashboardData]);

  const bestSellers = useMemo(() => {
    if (!dashboardData?.bestSellingMedicines?.length) return [];
    return dashboardData.bestSellingMedicines.map((m) => ({
      name: m.name,
      sold: m.quantity,
      revenue: 0,
    }));
  }, [dashboardData]);

  const topCustomers = useMemo(
    () => dashboardData?.topCustomers || [],
    [dashboardData]
  );

  const categoryMix = useMemo(() => {
    const palette = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444"];
    if (dashboardData?.bestSellingMedicines?.length) {
      return dashboardData.bestSellingMedicines.map((m, i) => ({
        name: m.name || "Medicine",
        value: Number(m.quantity) || 1,
        color: palette[i % palette.length],
      }));
    }
    return [
      { name: "Tablets", value: 35, color: palette[0] },
      { name: "Syrups", value: 22, color: palette[1] },
      { name: "Injections", value: 18, color: palette[2] },
      { name: "OTC", value: 15, color: palette[3] },
      { name: "Other", value: 10, color: palette[4] },
    ];
  }, [dashboardData]);

  const recentInvoices = useMemo(
    () => [
      { id: "INV-10291", customer: "Anita P.", amount: 860, method: "UPI", status: "Paid" },
      { id: "INV-10290", customer: "Rahul S.", amount: 1240, method: "Cash", status: "Paid" },
      { id: "INV-10289", customer: "Vijay K.", amount: 540, method: "Card", status: "Pending" },
      { id: "INV-10288", customer: "Meera A.", amount: 2120, method: "UPI", status: "Paid" },
    ],
    []
  );


  return (
    <div className="dash">
      <div className="dash-header">
        <div className="dash-header-left">
          <div className="dash-title-row">
            <span className="dash-logo">MS</span>
            <div>
              <h2 className="dash-title">Dashboard</h2>
              <p className="dash-subtitle">MEDBILLING Support System</p>
            </div>
          </div>
          <div className="dash-meta">
            <span className="dash-date">{formatDateLong(today)}</span>
            <span className="dash-meta-dot">•</span>
            <span className="dash-health">
              <ShieldCheck size={16} /> System Healthy
            </span>
          </div>
        </div>

        <div className="dash-header-actions">
          <button className="btn" onClick={() => navigate("/add-medicine")}>
            <CirclePlus size={16} /> Add Medicine
          </button>
          <button className="btn btn-primary" onClick={() => navigate("/sales")}>
            <FileText size={16} /> New Bill
          </button>
          <button
            className="btn dash-notify"
            aria-label="Dashboard notifications"
            onClick={() => setNotificationsOpen((value) => !value)}
          >
            <Bell size={16} />
            <span className="dash-notify-dot" />
            {notificationCount > 0 && <span className="dash-notify-count">{notificationCount}</span>}
          </button>
        </div>
        {notificationsOpen && (
          <div className="dash-notification-panel">
            <div className="notification-panel-head">
              <span>Inventory Alerts</span>
              <button className="close-btn" onClick={() => setNotificationsOpen(false)}>
                ×
              </button>
            </div>
            <div className="notification-items">
              {dashboardNotifications.map((notification, index) => (
                <div className="notification-item" key={`${notification.title}-${index}`}>
                  <div className="notification-type">{notification.type}</div>
                  <div className="notification-title">{notification.title}</div>
                  <div className="notification-subtitle">{notification.subtitle}</div>
                  {notification.detail && <div className="notification-detail">{notification.detail}</div>}
                </div>
              ))}
            </div>
            <button className="btn btn-secondary notification-view" onClick={() => { setNotificationsOpen(false); navigate('/expiry-alerts'); }}>
              View full alerts
            </button>
          </div>
        )}
      </div>

      {(loading || error) && (
        <div className={`dash-banner ${error ? "dash-banner-error" : "dash-banner-loading"}`}>
          {error
            ? `Unable to load some dashboard data: ${error}. Showing available sections.`
            : "Loading dashboard data..."
          }
        </div>
      )}

      <div className="dash-search-card card">
        <div className="search-card-head">
          <div>
            <h3>Search Medicines</h3>
            <p>Type a medicine name, company, or generic name to display matching inventory results on the dashboard.</p>
          </div>
          <button className="btn btn-secondary" onClick={() => setSearchQuery("")}>Clear</button>
        </div>
        <div className="search-row">
          <div className="search-field">
            <Search size={18} />
            <input
              type="text"
              placeholder="Search medicines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setSearchQuery(searchQuery.trim())}>
            Search
          </button>
        </div>
        <div className="search-results-card">
          {searchLoading && <div className="search-loading">Searching medicines...</div>}
          {searchError && <div className="search-error">{searchError}</div>}
          {!searchLoading && !searchError && searchResults.length === 0 && (
            <div className="search-hint">
              {searchQuery.trim()
                ? "No medicines match that keyword. Try a different name, company, or generic name."
                : "Inventory is empty or still loading. Add medicines to display them here."
              }
            </div>
          )}
          {!searchLoading && !searchError && searchResults.length > 0 && (
            <div>
              <div className="search-summary">
                {searchQuery.trim()
                  ? `Found ${searchResults.length} medicines for "${searchQuery.trim()}"`
                  : `Showing all ${searchResults.length} medicines A–Z`}
              </div>
              <DataTable
                title="Inventory Search Results"
                subtitle="Search results are filtered by name, company, and generic name."
                columns={inventoryColumns}
                rows={searchResults}
                rowKey={(row) => row.productId || row.barcode || row.name}
                searchable={false}
                initialPageSize={10}
                pageSizeOptions={[5, 10, 20, 50]}
              />
            </div>
          )}
        </div>
      </div>

      <section className="dash-grid">
        <div className="card welcome-card">
          <div className="welcome-left">
            <p className="welcome-kicker">Welcome back</p>
            <h3 className="welcome-title">Divya</h3>
            <p className="welcome-sub">
              Role: <b>Admin</b> • Today: <b>{today.toLocaleDateString("en-IN")}</b>
            </p>
            <div className="welcome-badges">
              <span className="badge badge-blue">Clinic Theme</span>
              <span className="badge badge-green">Inventory Sync Ready</span>
              <span className="badge badge-gray">Secure Session</span>
            </div>
          </div>

          <div className="welcome-illus" aria-hidden="true">
            <svg viewBox="0 0 260 140" className="welcome-svg">
              <defs>
                <linearGradient id="g1" x1="0" x2="1">
                  <stop offset="0" stopColor="#E0F2FE" />
                  <stop offset="1" stopColor="#F8FAFC" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="260" height="140" rx="18" fill="url(#g1)" />
              <circle cx="188" cy="52" r="32" fill="#3B82F6" opacity="0.15" />
              <circle cx="212" cy="84" r="24" fill="#10B981" opacity="0.15" />
              <path
                d="M56 88c18-26 46-36 74-20 20 12 34 10 52-10"
                stroke="#3B82F6"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
              />
              <path
                d="M60 54h22v-22h18v22h22v18h-22v22H82V72H60z"
                fill="#10B981"
                opacity="0.35"
              />
              <text x="34" y="120" fill="#64748B" fontSize="12" fontFamily="Inter">
                Pharmacy system overview
              </text>
            </svg>
          </div>
        </div>

        <div className="kpi-grid">
          {kpis.map((k) => {
            const Icon = k.icon;
            const value = k.valueFormatter ? k.valueFormatter(k.value) : k.value;
            return (
              <div key={k.title} className={`card kpi-card kpi-${k.accent}`}>
                <div className="kpi-top">
                  <div className="kpi-icon">
                    <Icon size={18} />
                  </div>
                  <Trend value={k.trend} />
                </div>
                <div className="kpi-body">
                  <div className="kpi-title">{k.title}</div>
                  <div className="kpi-value">{value}</div>
                  <div className="kpi-helper">{k.helper}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="card chart-card chart-sales">
          <div className="card-head">
            <h3>Sales Overview (Last 7 Days)</h3>
            <p>Daily sales performance</p>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={sales7d.length ? sales7d : [{ day: "—", sales: 0 }]} margin={{ top: 10, right: 18, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#3B82F6" stopOpacity={0.22} />
                    <stop offset="1" stopColor="#3B82F6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="day" stroke="#64748B" tickLine={false} axisLine={false} />
                <YAxis
                  stroke="#64748B"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip formatter={(v) => INR.format(v)} />
                <Area type="monotone" dataKey="sales" stroke="#3B82F6" fill="url(#salesFill)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card chart-card chart-cat">
          <div className="card-head">
            <h3>Medicine Category Distribution</h3>
            <p>Stock by category</p>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Tooltip />
                <Pie data={categoryMix} dataKey="value" nameKey="name" innerRadius={60} outerRadius={92} paddingAngle={2}>
                  {categoryMix.map((c) => (
                    <Cell key={c.name} fill={c.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card chart-card chart-cat">
          <div className="card-head">
            <h3>Profit & Loss Analysis</h3>
            <p>Revenue vs Cost breakdown</p>
          </div>
          <div className="chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Tooltip />
                <Pie data={profitLossData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={92} paddingAngle={2}>
                  {profitLossData.map((c) => (
                    <Cell key={c.name} fill={c.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card table-card">
          <div className="card-head card-head-row">
            <div>
              <h3>Best Selling Medicines</h3>
              <p>Top medicines by units sold</p>
            </div>
            <button className="btn" onClick={() => navigate("/reports")}>
              <FileText size={16} /> View Reports
            </button>
          </div>
          <div className="table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th className="num">Total Sold</th>
                  <th className="num">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {bestSellers.map((m) => (
                  <tr key={m.name}>
                    <td className="strong">{m.name}</td>
                    <td className="num">{m.sold}</td>
                    <td className="num">{INR.format(m.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card table-card">
          <div className="card-head card-head-row">
            <div>
              <h3>Recent Sales</h3>
              <p>Latest invoices and payment status</p>
            </div>
            <button className="btn btn-primary" onClick={() => navigate("/sales")}>
              <CreditCard size={16} /> Open Billing
            </button>
          </div>
          <div className="table-wrap">
            <table className="dash-table">
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Customer</th>
                  <th className="num">Amount</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((i) => (
                  <tr key={i.id}>
                    <td className="mono">{i.id}</td>
                    <td className="strong">{i.customer}</td>
                    <td className="num">{INR.format(i.amount)}</td>
                    <td>{i.method}</td>
                    <td>
                      <span className={`status ${i.status === "Paid" ? "status-paid" : "status-pending"}`}>
                        {i.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card quick-card">
          <div className="card-head">
            <h3>Quick Actions</h3>
            <p>Fast shortcuts for daily work</p>
          </div>
          <div className="quick-grid">
            <button className="quick-action" onClick={() => navigate("/sales")}>
              <FileText size={18} />
              <div>
                <div className="quick-title">Create New Bill</div>
                <div className="quick-sub">Fast POS billing</div>
              </div>
            </button>
            <button className="quick-action" onClick={() => navigate("/add-medicine")}>
              <CirclePlus size={18} />
              <div>
                <div className="quick-title">Add Medicine</div>
                <div className="quick-sub">Update stock master</div>
              </div>
            </button>
            <button className="quick-action" onClick={() => navigate("/suppliers")}>
              <UserPlus size={18} />
              <div>
                <div className="quick-title">Add Supplier</div>
                <div className="quick-sub">Supplier management</div>
              </div>
            </button>
            <button className="quick-action" onClick={() => navigate("/reports")}>
              <FileText size={18} />
              <div>
                <div className="quick-title">View Reports</div>
                <div className="quick-sub">Sales & GST insights</div>
              </div>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
