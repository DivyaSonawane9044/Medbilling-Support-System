import React, { useState } from "react";
import "./AddMedicine.css";
import { productsAPI, handleApiError } from "../services/api";

const AddMedicine = () => {
  const [form, setForm] = useState({
    name: "",
    genericName: "",
    batchNo: "",
    expiryDate: "",
    quantity: "",
    price: "",
    gst: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Convert form data to match backend Product model
      const productData = {
        name: form.name,
        genericName: form.genericName || null,
        company: form.company || null,
        batchNo: form.batchNo || null,
        expiryDate: form.expiryDate ? new Date(form.expiryDate).toISOString().split('T')[0] : null,
        stripSize: parseInt(form.stripSize) || 10,
        reorderLevel: parseInt(form.reorderLevel) || 10,
        targetStockLevel: parseInt(form.targetStockLevel) || 100,
        hsnCode: form.hsnCode || "30049099",
        dosageForm: form.dosageForm || "Tablet",
        composition: form.composition || null,
        volumeMl: form.volumeMl ? parseFloat(form.volumeMl) : null,
        weightGm: form.weightGm ? parseFloat(form.weightGm) : null,
        profitMargin: form.profitMargin ? parseFloat(form.profitMargin) : 0.2,
        scheduleDrugType: form.scheduleDrugType || "OTC",
        barcode: form.barcode || null,
      };

      const response = await productsAPI.create(productData);
      console.log("Medicine created:", response.data);
      alert("Medicine added successfully!");
      
      // Reset form
      setForm({
        name: "",
        genericName: "",
        batchNo: "",
        expiryDate: "",
        quantity: "",
        price: "",
        gst: "",
      });
    } catch (err) {
      setError(handleApiError(err).message);
      alert('Error adding medicine: ' + handleApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="add-medicine-container">
      <h2>Add Medicine</h2>

      {error && <div className="error-message">{error}</div>}

      <form className="medicine-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="input-group">
            <label>Name *</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required />
          </div>

          <div className="input-group">
            <label>Generic Name</label>
            <input type="text" name="genericName" value={form.genericName} onChange={handleChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="input-group">
            <label>Company</label>
            <input type="text" name="company" value={form.company || ""} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Batch No</label>
            <input type="text" name="batchNo" value={form.batchNo} onChange={handleChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="input-group">
            <label>Expiry Date</label>
            <input type="date" name="expiryDate" value={form.expiryDate} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Strip Size</label>
            <input type="number" name="stripSize" value={form.stripSize || 10} onChange={handleChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="input-group">
            <label>Reorder Level</label>
            <input type="number" name="reorderLevel" value={form.reorderLevel || 10} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Target Stock Level</label>
            <input type="number" name="targetStockLevel" value={form.targetStockLevel || 100} onChange={handleChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="input-group">
            <label>HSN Code</label>
            <input type="text" name="hsnCode" value={form.hsnCode || "30049099"} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Dosage Form</label>
            <select name="dosageForm" value={form.dosageForm || "Tablet"} onChange={handleChange}>
              <option value="Tablet">Tablet</option>
              <option value="Capsule">Capsule</option>
              <option value="Syrup">Syrup</option>
              <option value="Injection">Injection</option>
              <option value="Cream">Cream</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="input-group">
            <label>Schedule Drug Type</label>
            <select name="scheduleDrugType" value={form.scheduleDrugType || "OTC"} onChange={handleChange}>
              <option value="OTC">OTC</option>
              <option value="Schedule H">Schedule H</option>
              <option value="Schedule X">Schedule X</option>
            </select>
          </div>

          <div className="input-group">
            <label>Profit Margin (%)</label>
            <input type="number" step="0.01" name="profitMargin" value={form.profitMargin || 0.2} onChange={handleChange} />
          </div>
        </div>

        <div className="form-row">
          <div className="input-group">
            <label>Barcode</label>
            <input type="text" name="barcode" value={form.barcode || ""} onChange={handleChange} />
          </div>

          <div className="input-group">
            <label>Composition</label>
            <input type="text" name="composition" value={form.composition || ""} onChange={handleChange} />
          </div>
        </div>

        <button type="submit" className="save-btn" disabled={loading}>
          {loading ? "Saving..." : "Save Medicine"}
        </button>
      </form>
    </div>
  );
};

export default AddMedicine;

