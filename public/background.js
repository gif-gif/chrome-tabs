const configureSidePanel = () => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(console.error)
}

chrome.runtime.onInstalled.addListener(configureSidePanel)
chrome.runtime.onStartup.addListener(configureSidePanel)
