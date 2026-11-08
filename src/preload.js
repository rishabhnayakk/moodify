const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("moodify", {
  onUpdate(callback) {
    ipcRenderer.on("moodify:update", (_event, state) => callback(state));
  }
});
