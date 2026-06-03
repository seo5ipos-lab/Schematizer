const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Loki = require('lokijs');

let db;
let projects;

function initDB() {
  // База данных в AppData
  const dbPath = path.join(app.getPath('userData'), 'schematizer.db');
  db = new Loki(dbPath, {
    autoload: true,
    autoloadCallback: databaseInitialize,
    autosave: true, 
    autosaveInterval: 4000
  });
}

function databaseInitialize() {
  projects = db.getCollection("projects");
  if (projects === null) {
    projects = db.addCollection("projects");
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  initDB();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Простые обработчики для сохранения/загрузки проектов
ipcMain.handle('get-projects', () => {
  return projects.find();
});

ipcMain.handle('add-project', (event, project) => {
  projects.insert(project);
  return projects.find();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
