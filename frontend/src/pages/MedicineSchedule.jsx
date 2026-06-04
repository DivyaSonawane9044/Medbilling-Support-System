import React, { useState } from "react";
import "./MedicineSchedule.css";
import { prescriptionAPI, handleApiError } from "../services/api";

const MedicineSchedule = () => {
  const [formData, setFormData] = useState({
    medicineName: "",
    morning: false,
    afternoon: false,
    evening: false,
    night: false,
    instructions: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setFormData({
      ...formData,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await prescriptionAPI.save(formData);
      alert("Prescription saved successfully!");
      setFormData({
        medicineName: "",
        morning: false,
        afternoon: false,
        evening: false,
        night: false,
        instructions: "",
      });
    } catch (err) {
      alert('Error saving prescription: ' + handleApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="schedule-container">
      <div className="schedule-box">
        <h1>Medicine Timetable</h1>

        <form onSubmit={handleSubmit}>
          {/* Medicine Name */}
          <label>Medicine Name</label>
          <input
            type="text"
            name="medicineName"
            placeholder="Enter medicine name"
            value={formData.medicineName}
            onChange={handleChange}
            required
          />

          {/* Timings */}
          <label>Dosage Timings</label>
          <div className="timing-options">
            <label>
              <input
                type="checkbox"
                name="morning"
                checked={formData.morning}
                onChange={handleChange}
              />
              Morning
            </label>

            <label>
              <input
                type="checkbox"
                name="afternoon"
                checked={formData.afternoon}
                onChange={handleChange}
              />
              Afternoon
            </label>

            <label>
              <input
                type="checkbox"
                name="evening"
                checked={formData.evening}
                onChange={handleChange}
              />
              Evening
            </label>

            <label>
              <input
                type="checkbox"
                name="night"
                checked={formData.night}
                onChange={handleChange}
              />
              Night
            </label>
          </div>

          {/* Instructions */}
          <label>Special Instructions</label>
          <textarea
            name="instructions"
            placeholder="Before food / After food / With water etc..."
            value={formData.instructions}
            onChange={handleChange}
          ></textarea>

          <button type="submit" className="save-btn" disabled={loading}>
            {loading ? 'Saving...' : 'Save Prescription'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MedicineSchedule;
