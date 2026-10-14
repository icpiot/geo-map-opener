const firstByTab = new Map();
const smartCoordinateByTab = new Map();

function extractNumber(text) {
  const match = text.match(/-?\d+(\.\d+)?/);
  return match ? match[0] : null;
}

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "use-geo",
      title: "Use as Geo Coordinate",
      contexts: ["all"]
    });
  });
}

function openCoordinate(tabId, coordinate) {
  if (!coordinate) return false;
  const { latitude, longitude } = coordinate;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;

  chrome.tabs.create({ url: `https://maps.google.com/?q=${latitude},${longitude}` });
  smartCoordinateByTab.delete(tabId);
  firstByTab.delete(tabId);
  return true;
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
});

// Recreate the menu when the service worker starts, including after reloads.
setupContextMenu();

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== "geo-context" || !sender.tab) return;

  smartCoordinateByTab.set(sender.tab.id, {
    coordinate: message.coordinate,
    timestamp: Date.now()
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  firstByTab.delete(tabId);
  smartCoordinateByTab.delete(tabId);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "use-geo") return;

  const tabId = tab && tab.id;
  const smart = tabId == null ? null : smartCoordinateByTab.get(tabId);
  if (smart && Date.now() - smart.timestamp < 10000 && openCoordinate(tabId, smart.coordinate)) {
    return;
  }

  if (tabId == null) return;

  // Ask the frame that received the right-click for its latest DOM analysis.
  chrome.tabs.sendMessage(
    tabId,
    { type: "get-geo-context" },
    { frameId: Number.isInteger(info.frameId) ? info.frameId : 0 },
    (response) => {
      if (!chrome.runtime.lastError && openCoordinate(tabId, response?.coordinate)) return;

      const num = extractNumber(info.selectionText);
      if (!num) return;

      if (!firstByTab.has(tabId)) {
        firstByTab.set(tabId, num);
        return;
      }

      openCoordinate(tabId, {
        latitude: Number(firstByTab.get(tabId)),
        longitude: Number(num)
      });
    }
  );
});
