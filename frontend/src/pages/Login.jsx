import React, { useState } from "react";
import api from "../services/api";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = async () => {
    await api.post("/auth/login", { email, password });
    alert("Login Successful");
  };

  return (
    <div>
      <h1>Login</h1>
      <input placeholder="Email" onChange={(e)=>setEmail(e.target.value)} /><br />
      <input placeholder="Password" type="password" onChange={(e)=>setPassword(e.target.value)} /><br />
      <button onClick={login}>Login</button>
    </div>
  );
}
