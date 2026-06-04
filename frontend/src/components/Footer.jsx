import React from "react";
import "./Footer.css";
import logo from "../assets/medical-logo.png"; // <-- update path AFTER adding your logo

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-left">
        <img src={logo} alt="Medical Shop Logo" className="footer-logo" />
      </div>

      <div className="footer-right">
        <p>© 2025 RetailPulse Medical Billing System</p>
        <p>Developed by Divya Sonawane</p>
      </div>
    </footer>
  );
};

export default Footer;
