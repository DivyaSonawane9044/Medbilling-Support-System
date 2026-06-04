import React, { useState } from "react";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import "./ProductMaster.css";
import { Package, Plus, Edit, Trash2 } from "lucide-react";

const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function ProductMaster() {
  const [products] = useState([
    {
      id: "1",
      name: "Paracetamol 650mg",
      genericName: "Paracetamol",
      company: "Cipla Ltd",
      hsnCode: "30049010",
      scheduleType: "OTC",
      stripSize: 10,
      mrp: 30.00,
      costPrice: 22.50,
      sellingPrice: 28.00,
      gstRate: "12",
      reorderLevel: 50,
      currentStock: 125,
      expiryDate: "2026-12-31",
      manufacturerDate: "2024-01-15"
    },
    {
      id: "2",
      name: "Azithromycin 500mg",
      genericName: "Azithromycin",
      company: "Sun Pharma",
      hsnCode: "30042090",
      scheduleType: "H",
      stripSize: 3,
      mrp: 150.00,
      costPrice: 110.00,
      sellingPrice: 135.00,
      gstRate: "12",
      reorderLevel: 25,
      currentStock: 18,
      expiryDate: "2025-11-30",
      manufacturerDate: "2023-11-30"
    }
  ]);

  const calculateProfitMargin = (costPrice, sellingPrice) => {
    if (!costPrice || !sellingPrice) return 0;
    return ((sellingPrice - costPrice) / costPrice * 100).toFixed(2);
  };

  const getStockStatus = (currentStock, reorderLevel) => {
    if (currentStock === 0) return { status: "Out of Stock", color: "red" };
    if (currentStock <= reorderLevel) return { status: "Low Stock", color: "orange" };
    return { status: "In Stock", color: "green" };
  };

  const columns = [
    {
      key: "name",
      header: "Product Name",
      cell: (value, row) => (
        <div>
          <div style={{ fontWeight: 600, color: "#1f2937" }}>{row.name}</div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>Generic: {row.genericName}</div>
          <div style={{ fontSize: "11px", color: "#9ca3af" }}>{row.company}</div>
        </div>
      )
    },
    {
      key: "pricing",
      header: "Pricing",
      cell: (value, row) => (
        <div>
          <div style={{ fontSize: "12px" }}>
            <span style={{ color: "#6b7280" }}>MRP: </span>
            <span style={{ color: "#dc2626", fontWeight: 600 }}>{INR.format(row.mrp)}</span>
          </div>
          <div style={{ fontSize: "12px" }}>
            <span style={{ color: "#6b7280" }}>Cost: </span>
            <span style={{ color: "#059669", fontWeight: 600 }}>{INR.format(row.costPrice)}</span>
          </div>
          <div style={{ fontSize: "12px" }}>
            <span style={{ color: "#6b7280" }}>Selling: </span>
            <span style={{ color: "#4f46e5", fontWeight: 600 }}>{INR.format(row.sellingPrice)}</span>
          </div>
        </div>
      )
    },
    {
      key: "profit",
      header: "Profit",
      cell: (value, row) => {
        const margin = calculateProfitMargin(row.costPrice, row.sellingPrice);
        return (
          <div>
            <div style={{ fontSize: "12px" }}>
              <span style={{ color: "#6b7280" }}>Margin: </span>
              <span style={{ 
                color: parseFloat(margin) > 20 ? "#059669" : parseFloat(margin) > 10 ? "#f59e0b" : "#dc2626",
                fontWeight: 600 
              }}>
                {margin}%
              </span>
            </div>
            <div style={{ fontSize: "12px" }}>
              <span style={{ color: "#6b7280" }}>GST: </span>
              <span style={{ color: "#7c3aed", fontWeight: 600 }}>{row.gstRate}%</span>
            </div>
          </div>
        );
      }
    },
    {
      key: "stock",
      header: "Stock",
      cell: (value, row) => {
        const stockStatus = getStockStatus(row.currentStock, row.reorderLevel);
        return (
          <div>
            <div style={{ fontSize: "12px" }}>
              <span style={{ color: "#6b7280" }}>Current: </span>
              <span style={{ color: "#059669", fontWeight: 600 }}>{row.currentStock}</span>
            </div>
            <div style={{ fontSize: "12px" }}>
              <span style={{ color: "#6b7280" }}>Reorder: </span>
              <span style={{ color: "#f59e0b", fontWeight: 600 }}>{row.reorderLevel}</span>
            </div>
            <Badge type={stockStatus.color}>
              {stockStatus.status}
            </Badge>
          </div>
        );
      }
    }
  ];

  return (
    <div style={{ padding: "24px", background: "#f8f9fa", minHeight: "100vh" }}>
      <div style={{ 
        background: "white", 
        borderRadius: "12px", 
        padding: "24px", 
        marginBottom: "24px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
          <Package style={{ color: "#4f46e5" }} size={32} />
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#1f2937", margin: "0 0 4px 0" }}>
              Product Master & Pricing
            </h1>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: "0" }}>
              Manage medicines, pricing, and inventory settings
            </p>
          </div>
        </div>
      </div>

      <div style={{ 
        background: "white", 
        borderRadius: "12px", 
        padding: "24px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)"
      }}>
        <DataTable
          columns={columns}
          rows={products}
        />
      </div>
    </div>
  );
}

export default ProductMaster;
