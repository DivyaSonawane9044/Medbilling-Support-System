import React, { useState } from "react";
import DataTable from "../components/ui/DataTable";
import Badge from "../components/ui/Badge";
import FormField from "../components/ui/FormField";
import TextInput from "../components/ui/TextInput";
import Select from "../components/ui/Select";
import "./Settings.css";
import { 
  Settings as SettingsIcon, 
  Users, 
  Building2, 
  Calculator, 
  Bell, 
  Database, 
  Shield, 
  Printer,
  Download,
  Upload,
  Save,
  RefreshCw
} from "lucide-react";

function Settings() {
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState({
    // General Settings
    pharmacyName: "MedPlus Pharmacy",
    address: "123 Main Street, Mumbai, Maharashtra 400001",
    phone: "+91-22-12345678",
    email: "info@medpluspharmacy.com",
    gstNumber: "27ABCDE1234F1Z5",
    licenseNumber: "PH-MH-2023-1234",
    
    // Tax Settings
    cgstRate: 6,
    sgstRate: 6,
    defaultGstRate: 12,
    
    // Billing Settings
    printHeader: true,
    printFooter: true,
    autoSaveDrafts: true,
    enableBarcode: true,
    defaultPaymentMethod: "Cash",
    
    // Inventory Settings
    lowStockThreshold: 20,
    expiryAlertDays: 90,
    enableBatchTracking: true,
    autoReorderEnabled: false,
    
    // Notification Settings
    emailNotifications: true,
    smsNotifications: false,
    desktopNotifications: true,
    
    // User Settings
    allowMultipleSessions: false,
    sessionTimeout: 30,
    requirePasswordChange: true,
    
    // Backup Settings
    autoBackupEnabled: true,
    backupFrequency: "daily",
    backupRetentionDays: 30,
    backupLocation: "local"
  });

  const [users] = useState([
    {
      id: 1,
      name: "Admin User",
      email: "admin@medplus.com",
      role: "Administrator",
      lastLogin: "2026-04-06 10:30 AM",
      status: "Active"
    },
    {
      id: 2,
      name: "John Doe",
      email: "john@medplus.com",
      role: "Pharmacist",
      lastLogin: "2026-04-06 09:15 AM",
      status: "Active"
    },
    {
      id: 3,
      name: "Jane Smith",
      email: "jane@medplus.com",
      role: "Sales",
      lastLogin: "2026-04-05 04:45 PM",
      status: "Active"
    }
  ]);

  const handleGeneralSettingChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    localStorage.setItem("pharmacy_settings", JSON.stringify(settings));
    alert("Settings saved successfully!");
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(settings, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = 'pharmacy_settings.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const imported = JSON.parse(e.target.result);
          setSettings(imported);
          alert("Settings imported successfully!");
        } catch (error) {
          alert("Invalid settings file!");
        }
      };
      reader.readAsText(file);
    }
  };

  const tabs = [
    { id: "general", label: "General", icon: Building2 },
    { id: "tax", label: "Tax & Billing", icon: Calculator },
    { id: "inventory", label: "Inventory", icon: Database },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "users", label: "Users", icon: Users },
    { id: "security", label: "Security", icon: Shield },
    { id: "backup", label: "Backup", icon: Database }
  ];

  const userColumns = [
    {
      key: "name",
      header: "Name",
      cell: (value, row) => (
        <div>
          <div style={{ fontWeight: 600 }}>{row.name}</div>
          <div style={{ fontSize: "12px", color: "#6b7280" }}>{row.email}</div>
        </div>
      )
    },
    {
      key: "role",
      header: "Role",
      cell: (value, row) => (
        <Badge type={row.role === "Administrator" ? "warning" : "info"}>
          {row.role}
        </Badge>
      )
    },
    {
      key: "lastLogin",
      header: "Last Login",
      cell: (value, row) => (
        <div style={{ fontSize: "14px" }}>{row.lastLogin}</div>
      )
    },
    {
      key: "status",
      header: "Status",
      cell: (value, row) => (
        <Badge type={row.status === "Active" ? "success" : "danger"}>
          {row.status}
        </Badge>
      )
    }
  ];

  return (
    <div className="settings-container">
      <div className="settings-header">
        <div className="header-content">
          <div className="header-title">
            <SettingsIcon className="title-icon" size={32} />
            <div>
              <h1>Settings</h1>
              <p>Configure pharmacy preferences, taxes, and system settings</p>
            </div>
          </div>
          <div className="header-actions">
            <button onClick={handleExport} className="btn btn-export">
              <Download size={16} />
              Export
            </button>
            <label className="btn btn-import">
              <Upload size={16} />
              Import
              <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
            </label>
            <button onClick={handleSave} className="btn btn-primary">
              <Save size={16} />
              Save Settings
            </button>
          </div>
        </div>
      </div>

      <div className="settings-content">
        <div className="settings-tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="settings-panel">
          {activeTab === "general" && (
            <div className="settings-section">
              <h2>General Settings</h2>
              <div className="settings-grid">
                <FormField label="Pharmacy Name">
                  <TextInput
                    value={settings.pharmacyName}
                    onChange={(e) => handleGeneralSettingChange("pharmacyName", e.target.value)}
                    placeholder="Enter pharmacy name"
                  />
                </FormField>
                <FormField label="Phone Number">
                  <TextInput
                    value={settings.phone}
                    onChange={(e) => handleGeneralSettingChange("phone", e.target.value)}
                    placeholder="Enter phone number"
                  />
                </FormField>
                <FormField label="Email Address" className="full-width">
                  <TextInput
                    value={settings.email}
                    onChange={(e) => handleGeneralSettingChange("email", e.target.value)}
                    placeholder="Enter email address"
                    type="email"
                  />
                </FormField>
                <FormField label="Address" className="full-width">
                  <TextInput
                    value={settings.address}
                    onChange={(e) => handleGeneralSettingChange("address", e.target.value)}
                    placeholder="Enter address"
                  />
                </FormField>
                <FormField label="GST Number">
                  <TextInput
                    value={settings.gstNumber}
                    onChange={(e) => handleGeneralSettingChange("gstNumber", e.target.value)}
                    placeholder="Enter GST number"
                  />
                </FormField>
                <FormField label="License Number">
                  <TextInput
                    value={settings.licenseNumber}
                    onChange={(e) => handleGeneralSettingChange("licenseNumber", e.target.value)}
                    placeholder="Enter license number"
                  />
                </FormField>
              </div>
            </div>
          )}

          {activeTab === "tax" && (
            <div className="settings-section">
              <h2>Tax & Billing Settings</h2>
              <div className="settings-grid">
                <FormField label="CGST Rate (%)">
                  <TextInput
                    type="number"
                    value={settings.cgstRate}
                    onChange={(e) => handleGeneralSettingChange("cgstRate", parseFloat(e.target.value))}
                    min="0"
                    max="50"
                  />
                </FormField>
                <FormField label="SGST Rate (%)">
                  <TextInput
                    type="number"
                    value={settings.sgstRate}
                    onChange={(e) => handleGeneralSettingChange("sgstRate", parseFloat(e.target.value))}
                    min="0"
                    max="50"
                  />
                </FormField>
                <FormField label="Default GST Rate (%)">
                  <Select
                    value={settings.defaultGstRate.toString()}
                    onChange={(e) => handleGeneralSettingChange("defaultGstRate", parseFloat(e.target.value))}
                    options={[
                      { value: "0", label: "0%" },
                      { value: "5", label: "5%" },
                      { value: "12", label: "12%" },
                      { value: "18", label: "18%" },
                      { value: "28", label: "28%" }
                    ]}
                  />
                </FormField>
                <FormField label="Default Payment Method">
                  <Select
                    value={settings.defaultPaymentMethod}
                    onChange={(e) => handleGeneralSettingChange("defaultPaymentMethod", e.target.value)}
                    options={[
                      { value: "Cash", label: "Cash" },
                      { value: "UPI", label: "UPI" },
                      { value: "Card", label: "Card" },
                      { value: "NetBanking", label: "Net Banking" }
                    ]}
                  />
                </FormField>
                <div className="settings-group">
                  <h3>Billing Options</h3>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.printHeader}
                      onChange={(e) => handleGeneralSettingChange("printHeader", e.target.checked)}
                    />
                    Print header on bills
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.printFooter}
                      onChange={(e) => handleGeneralSettingChange("printFooter", e.target.checked)}
                    />
                    Print footer on bills
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.autoSaveDrafts}
                      onChange={(e) => handleGeneralSettingChange("autoSaveDrafts", e.target.checked)}
                    />
                    Auto-save draft bills
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={settings.enableBarcode}
                      onChange={(e) => handleGeneralSettingChange("enableBarcode", e.target.checked)}
                    />
                    Enable barcode scanning
                  </label>
                </div>
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="settings-section">
              <h2>User Management</h2>
              <div className="user-table">
                <DataTable
                  columns={userColumns}
                  rows={users}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;

