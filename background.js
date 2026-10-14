const firstByTab = new Map();
const smartCoordinateByTab = new Map();

function extractNumber(text) {
  const match = String(text ?? "").match(/[-+]?\d+(\.\d+)?/);
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

function scanActivePageForCoordinate() {
  const numberValue = (field) => {
    const value = Number(field.value ?? field.textContent);
    return Number.isFinite(value) && Math.abs(value) <= 180 ? value : null;
  };

  const labelFor = (field) => {
    const previous = field.previousElementSibling;
    if (previous && previous.tagName === "LABEL") return previous.textContent;
    const label = field.closest("label");
    if (label) return label.textContent;
    return [field.getAttribute("aria-label"), field.getAttribute("name"), field.id]
      .filter(Boolean).join(" ");
  };

  const fields = Array.from(document.querySelectorAll("input, textarea, select"))
    .map((field) => ({ field, value: numberValue(field), label: labelFor(field) }))
    .filter((candidate) => candidate.value !== null);
  const target = document.activeElement;
  const targetField = fields.find((candidate) => candidate.field === target);

  let scope = targetField ? targetField.field : document.body;
  for (let level = 0; scope && level < 8; level += 1, scope = scope.parentElement) {
    const inScope = fields.filter((candidate) => scope.contains(candidate.field));
    const latitude = inScope.find((candidate) => /(^|[^a-z])(lat|latitude)([^a-z]|$)/i.test(candidate.label) && Math.abs(candidate.value) <= 90);
    const longitude = inScope.find((candidate) => /(^|[^a-z])(lon|lng|long|longitude)([^a-z]|$)/i.test(candidate.label));
    if (latitude && longitude) return { latitude: latitude.value, longitude: longitude.value };
  }

  return null;
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

  const frameId = Number.isInteger(info.frameId) ? info.frameId : 0;
  const fallback = () => {
    chrome.tabs.sendMessage(tabId, { type: "get-geo-context" }, { frameId }, (response) => {
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
    });
  };

  // Scan the active frame at click time so dynamically-created popups work too.
  chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    func: scanActivePageForCoordinate
  }).then((results) => {
    if (!openCoordinate(tabId, results[0]?.result)) fallback();
  }).catch(fallback);
});
