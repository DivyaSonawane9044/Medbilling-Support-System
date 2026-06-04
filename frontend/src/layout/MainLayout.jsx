import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Navbar from "../components/Navbar";
import "./layout.css";

function MainLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell-main">
        <Navbar />
        <main className="app-shell-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default MainLayout;


