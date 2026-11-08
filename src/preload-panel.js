const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("moodifyPanel", {
  hasCredentials: ()         => ipcRenderer.invoke("spotify:has-credentials"),
  getPlaylists:   (mood)     => ipcRenderer.invoke("spotify:get-playlists", mood),
  getTrack:       ()         => ipcRenderer.invoke("spotify:get-track"),
  playPlaylist:   (uri)      => ipcRenderer.invoke("spotify:play-playlist", uri),
  pause:          ()         => ipcRenderer.invoke("spotify:pause"),
  resume:         ()         => ipcRenderer.invoke("spotify:resume"),
  next:           ()         => ipcRenderer.invoke("spotify:next"),
  prev:           ()         => ipcRenderer.invoke("spotify:prev"),
  closePanel:     ()         => ipcRenderer.send("panel:close"),
  openExternal:   (url)      => ipcRenderer.invoke("shell:open-external", url),
  onMoodChange(callback) {
    ipcRenderer.on("moodify:mood-change", (_e, mood) => callback(mood));
  },
});
