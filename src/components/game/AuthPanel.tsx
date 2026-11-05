"use client";

import { useState, type FormEvent } from "react";
import "./auth-panel.css";

export type AuthStatus = {
  authenticated: boolean;
  account: { userId: string; email: string } | null;
  guestSaveAvailable: boolean;
  localMode: boolean;
};

export async function fetchAuthStatus(): Promise<AuthStatus> {
  const response = await fetch("/api/auth", { cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Không đọc được phiên đăng nhập.");
  return body as AuthStatus;
}

async function postAuth(path: string, body?: unknown) {
  const response = await fetch(`/api/auth/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Không thể xử lý tài khoản.");
  return result;
}

export function AuthGate({ onAuthenticated, onBeforeAuthenticate, onGuest }: { onAuthenticated: () => Promise<void>; onBeforeAuthenticate: () => Promise<void>; onGuest: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      await onBeforeAuthenticate();
      await postAuth(mode, { email, password });
      setPassword("");
      await onAuthenticated();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Không thể đăng nhập."); }
    finally { setBusy(false); }
  }
  return <main className="auth-gate"><section className="auth-card panel">
    <span className="eyebrow">LIFE//LEVEL · NEON HAVEN</span>
    <h1>{mode === "login" ? "Đăng nhập để tiếp tục" : "Tạo tài khoản"}</h1>
    <p>Tiến độ, tài chính và lịch sử của bạn được lưu trên máy chủ để dùng trên nhiều thiết bị.</p>
    <form onSubmit={submit}>
      <label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254}/></label>
      <label>Mật khẩu<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={event => setPassword(event.target.value)} required minLength={mode === "register" ? 12 : 1} maxLength={128}/></label>
      {mode === "register" && <small>Dùng ít nhất 12 ký tự. Không dùng lại mật khẩu ở dịch vụ khác.</small>}
      {error && <p role="alert" className="auth-error">{error}</p>}
      <button className="btn primary" type="submit" disabled={busy}>{busy ? "Đang xử lý…" : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</button>
    </form>
    <button type="button" className="text-link" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>{mode === "login" ? "Chưa có tài khoản? Tạo mới" : "Đã có tài khoản? Đăng nhập"}</button>
    <button type="button" className="text-link" onClick={onGuest}>Tiếp tục với phiên khách trên thiết bị này</button>
  </section></main>;
}

export function AccountSettings({ status, onChanged, onLogin }: { status: AuthStatus; onChanged: () => Promise<void>; onLogin: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function action(path: "claim" | "logout") {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      await postAuth(path);
      await onChanged();
      setMessage(path === "claim" ? "Đã chuyển bản lưu khách sang tài khoản. Bản gốc được giữ lại." : "Đã đăng xuất trên thiết bị này.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Không thể xử lý tài khoản."); }
    finally { setBusy(false); }
  }
  return <section className="panel auth-account"><h3>Tài khoản & đồng bộ</h3>
    {status.localMode ? <p>Chế độ local dùng dữ liệu thử trên máy này. Tắt LOCAL_DEV_MODE và cấu hình PostgreSQL để dùng tài khoản.</p>
      : status.authenticated ? <>
        <p>Đã đăng nhập: <strong>{status.account?.email}</strong>. Dữ liệu đã lưu được đồng bộ theo tài khoản.</p>
        {status.guestSaveAvailable && <><p>Trình duyệt này còn bản lưu khách. Có thể chuyển sang tài khoản nếu tài khoản chưa có tiến độ; dữ liệu khách gốc vẫn được giữ.</p><button className="btn primary" type="button" disabled={busy} onClick={() => void action("claim")}>Chuyển bản lưu khách</button></>}
        <button className="btn ghost" type="button" disabled={busy} onClick={() => void action("logout")}>Đăng xuất</button>
      </> : <><p>Đang sử dụng phiên khách trên thiết bị này. Đăng nhập để đồng bộ nhiều máy.</p><button className="btn primary" type="button" onClick={onLogin}>Đăng nhập hoặc tạo tài khoản</button></>}
    {message && <p role="status">{message}</p>}
  </section>;
}
