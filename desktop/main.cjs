"use strict";

const path = require("node:path");
const { app, BrowserWindow, dialog, session } = require("electron");
const { parseServerUrl, isAllowedNavigationUrl, isAllowedDownloadUrl, readServerOrigin } = require("./security.cjs");

app.enableSandbox();
app.setAppUserModelId("com.lifelevel.neonhaven");
const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

let mainWindow;
app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

function configuredOrigin() {
  if (app.isPackaged) {
    return readServerOrigin(path.join(process.resourcesPath, "server.json"));
  }
  const allowLocalHttp = process.env.LIFE_LEVEL_ALLOW_LOCAL_HTTP === "true";
  return parseServerUrl(process.env.LIFE_LEVEL_SERVER_URL, allowLocalHttp);
}

async function createWindow() {
  const serverOrigin = configuredOrigin();
  const browserSession = session.fromPartition("persist:lifelevel");
  browserSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  browserSession.setPermissionCheckHandler(() => false);
  browserSession.on("will-download", (_event, item) => {
    if (!isAllowedDownloadUrl(item.getURL(), serverOrigin)) {
      item.cancel();
      return;
    }
    item.setSaveDialogOptions({ title: "Lưu tệp LIFE//LEVEL" });
  });

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: "#080d18",
    webPreferences: {
      partition: "persist:lifelevel",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false,
      webgl: true,
      devTools: !app.isPackaged
    }
  });
  mainWindow = win;
  win.once("ready-to-show", () => win.show());
  win.on("closed", () => { if (mainWindow === win) mainWindow = undefined; });

  const guardNavigation = (event, deprecatedUrl) => {
    const url = event.url || deprecatedUrl;
    if (!isAllowedNavigationUrl(url, serverOrigin)) event.preventDefault();
  };
  win.webContents.on("will-navigate", guardNavigation);
  win.webContents.on("will-redirect", guardNavigation);
  win.webContents.on("will-frame-navigate", guardNavigation);
  win.webContents.on("will-attach-webview", event => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("did-fail-load", async (_event, errorCode, _description, _url, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 || win.isDestroyed()) return;
    if (!win.isVisible()) win.show();
    const { response } = await dialog.showMessageBox(win, {
      type: "warning",
      title: "LIFE//LEVEL chưa kết nối được",
      message: "Không thể tải máy chủ. Kiểm tra Internet rồi thử lại.",
      buttons: ["Thử lại", "Đóng"],
      defaultId: 0,
      cancelId: 1
    });
    if (response === 0 && !win.isDestroyed()) void win.loadURL(`${serverOrigin}/`).catch(() => undefined);
    if (response === 1 && !win.isDestroyed()) win.close();
  });
  // did-fail-load owns retry UI. A rejected loadURL promise must not quit Electron.
  void win.loadURL(`${serverOrigin}/`).catch(() => undefined);
}

if (singleInstance) {
  app.whenReady().then(createWindow).catch(error => {
    dialog.showErrorBox("LIFE//LEVEL không thể khởi động", error.message);
    app.quit();
  });
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) void createWindow(); });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
}
