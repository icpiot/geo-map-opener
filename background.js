const firstByTab = new Map();
const smartCoordinateByTab = new Map();
const DEFAULT_PROVIDER = "google";
const PROVIDERS = {
  google: {
    title: "Google Maps",
    buildUrl: (latitude, longitude) =>
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
  },
  openstreetmap: {
    title: "OpenStreetMap",
    buildUrl: (latitude, longitude) =>
      `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=16`
  },
  bing: {
    title: "Bing Maps",
    buildUrl: (latitude, longitude) =>
      `https://bing.com/maps/default.aspx?cp=${latitude}~${longitude}&lvl=16`
  },
  apple: {
    title: "Apple Maps",
    buildUrl: (latitude, longitude) =>
      `https://maps.apple.com/?ll=${latitude},${longitude}`
  },
  waze: {
    title: "Waze",
    buildUrl: (latitude, longitude) =>
      `https://www.waze.com/ul?ll=${encodeURIComponent(`${latitude},${longitude}`)}&navigate=yes`
  },
  here: {
    title: "HERE WeGo",
    buildUrl: (latitude, longitude) =>
      `https://wego.here.com/directions/mix//${latitude},${longitude}`
  },
  mapquest: {
    title: "MapQuest",
    buildUrl: (latitude, longitude) =>
      `https://www.mapquest.com/latlng/${latitude},${longitude}`
  }
};

function extractNumber(text) {
  const match = String(text ?? "").match(/[-+]?\d+(\.\d+)?/);
  return match ? match[0] : null;
}

function coordinateFromUrl(value) {
  if (!value) return null;
  let decoded = String(value);
  try { decoded = decodeURIComponent(decoded); } catch {}

  const decimalCardinal = decoded.match(/([-+]?\d{1,3}(?:\.\d+)?)_([NS])_([-+]?\d{1,3}(?:\.\d+)?)_([EW])/i);
  if (decimalCardinal) {
    const latitude = Number(decimalCardinal[1]);
    const longitude = Number(decimalCardinal[3]);
    return {
      latitude: /[S]/i.test(decimalCardinal[2]) ? -Math.abs(latitude) : Math.abs(latitude),
      longitude: /[W]/i.test(decimalCardinal[4]) ? -Math.abs(longitude) : Math.abs(longitude)
    };
  }

  const geohack = decoded.match(/(\d{1,3})_(\d{1,2})_([\d.]+)_([NS])_(\d{1,3})_(\d{1,2})_([\d.]+)_([EW])/i);
  if (geohack) {
    const latitude = Number(geohack[1]) + Number(geohack[2]) / 60 + Number(geohack[3]) / 3600;
    const longitude = Number(geohack[5]) + Number(geohack[6]) / 60 + Number(geohack[7]) / 3600;
    return {
      latitude: /[SW]/i.test(geohack[4]) ? -latitude : latitude,
      longitude: /[W]/i.test(geohack[8]) ? -longitude : longitude
    };
  }

  try {
    const url = new URL(value);
    const params = url.searchParams;
    const pairs = [
      [params.get("mlat"), params.get("mlon")],
      ...["q", "query", "ll", "center", "coord", "coordinates"].map((key) =>
        (params.get(key) || "").split(/[,;|/~]/)),
      (params.get("cp") || "").split("~")
    ];
    for (const [latitudeText, longitudeText] of pairs) {
      const latitude = Number(latitudeText);
      const longitude = Number(longitudeText);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)
        && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
        return { latitude, longitude };
      }
    }
  } catch {}

  return null;
}

function setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "use-geo",
      title: "Use as Geo Coordinate",
      contexts: ["all"]
    });
    chrome.contextMenus.create({
      id: "use-geo-provider",
      title: "Use as Geo Coordinate in...",
      contexts: ["all"]
    });
    for (const [id, provider] of Object.entries(PROVIDERS)) {
      chrome.contextMenus.create({
        id: `use-geo-${id}`,
        parentId: "use-geo-provider",
        title: provider.title,
        contexts: ["all"]
      });
    }
    chrome.contextMenus.create({
      id: "geo-options",
      title: "Map provider settings...",
      contexts: ["all"]
    });
  });
}

function openCoordinate(tabId, coordinate, providerId = DEFAULT_PROVIDER) {
  if (!coordinate) return false;
  const { latitude, longitude } = coordinate;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;

  const provider = PROVIDERS[providerId] || PROVIDERS[DEFAULT_PROVIDER];
  chrome.tabs.create({ url: provider.buildUrl(latitude, longitude) });
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
  if (info.menuItemId === "geo-options") {
    chrome.runtime.openOptionsPage();
    return;
  }

  const providerId = info.menuItemId.startsWith("use-geo-")
    ? info.menuItemId.slice("use-geo-".length)
    : null;
  if (info.menuItemId !== "use-geo" && !PROVIDERS[providerId]) return;

  const tabId = tab && tab.id;
  chrome.storage.sync.get({ defaultProvider: DEFAULT_PROVIDER }, (settings) => {
    const provider = providerId || settings.defaultProvider || DEFAULT_PROVIDER;
    const linkedCoordinate = coordinateFromUrl(info.linkUrl);
    if (linkedCoordinate && openCoordinate(tabId, linkedCoordinate, provider)) return;

    const smart = tabId == null ? null : smartCoordinateByTab.get(tabId);
    if (smart && Date.now() - smart.timestamp < 10000 && openCoordinate(tabId, smart.coordinate, provider)) return;

    if (tabId == null) return;

    const frameId = Number.isInteger(info.frameId) ? info.frameId : 0;
    const fallback = () => {
      chrome.tabs.sendMessage(tabId, { type: "get-geo-context" }, { frameId }, (response) => {
        if (!chrome.runtime.lastError && openCoordinate(tabId, response?.coordinate, provider)) return;

        const num = extractNumber(info.selectionText);
        if (!num) return;

        if (!firstByTab.has(tabId)) {
          firstByTab.set(tabId, num);
          return;
        }

        openCoordinate(tabId, {
          latitude: Number(firstByTab.get(tabId)),
          longitude: Number(num)
        }, provider);
      });
    };

    // Scan the active frame at click time so dynamically-created popups work too.
    chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      func: scanActivePageForCoordinate
    }).then((results) => {
      if (!openCoordinate(tabId, results[0]?.result, provider)) fallback();
    }).catch(fallback);
  });
});
