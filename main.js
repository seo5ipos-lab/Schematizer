const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Loki = require('lokijs');

let db, projects, settings;

function initDB() {
  const dbPath = path.join(app.getPath('userData'), 'schematizer_pro_v2.db');
  db = new Loki(dbPath, {
    autoload: true,
    autoloadCallback: databaseInitialize,
    autosave: true, 
    autosaveInterval: 4000
  });
}

function databaseInitialize() {
  projects = db.getCollection("projects");
  if (projects === null) projects = db.addCollection("projects");

  settings = db.getCollection("global_settings");
  if (settings === null) {
    settings = db.addCollection("global_settings");
    // Добавили массив custom_properties
    settings.insert({ api_key: "", default_model: "google/gemini-2.5-flash", custom_properties: [] });
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
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
});

// Настройки и Кастомные свойства
ipcMain.handle('get-settings', () => settings.data[0]);
ipcMain.handle('save-settings', (event, newSettings) => {
  let current = settings.data[0];
  current.api_key = newSettings.api_key;
  current.default_model = newSettings.default_model;
  current.custom_properties = newSettings.custom_properties || [];
  settings.update(current);
  return current;
});

// Проекты и Динамические Константы
ipcMain.handle('get-projects', () => projects.find());
ipcMain.handle('add-project', (event, project) => {
  projects.insert(project);
  return projects.find();
});
ipcMain.handle('save-constants', (event, projectId, constantsArray) => {
  let project = projects.get(projectId);
  if (project) {
    project.constants = constantsArray; // Теперь это гибкий массив объектов
    projects.update(project);
  }
});

// ИИ
ipcMain.handle('ai-request', async (event, promptText) => {
  const config = settings.data[0];
  if (!config || !config.api_key) throw new Error("API ключ не настроен");

  const systemPrompt = `Ты генератор Schema.org JSON-LD. Верни ВАЛИДНЫЙ JSON объект разметки. Отвечай ТОЛЬКО чистым JSON без текста и markdown.`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${config.api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.default_model || "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: promptText }],
        response_format: { type: "json_object" }
      })
    });
    const data = await response.json();
    return JSON.parse(data.choices[0].message.content);
  } catch (error) {
    throw new Error(error.message);
  }
});
