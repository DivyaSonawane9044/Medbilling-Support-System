import React from "react";

export default function MedicineTable({ medicines }) {
  return (
    <table border="1" width="100%" cellPadding="10">
      <thead>
        <tr>
          <th>Name</th>
          <th>Generic</th>
          <th>Batch</th>
          <th>Expiry</th>
          <th>Qty</th>
          <th>Price</th>
          <th>GST</th>
        </tr>
      </thead>

      <tbody>
        {medicines.map((m) => (
          <tr key={m.id}>
            <td>{m.name}</td>
            <td>{m.generic_name}</td>
            <td>{m.batch_no}</td>
            <td>{m.expiry_date}</td>
            <td>{m.quantity}</td>
            <td>{m.price}</td>
            <td>{m.gst}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
