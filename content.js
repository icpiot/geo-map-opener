const NUMBER_PATTERN = /[-+]?\d+(?:\.\d+)?/g;
const LATITUDE_WORDS = /(^|[^a-z])(lat|latitude)([^a-z]|$)/i;
const LONGITUDE_WORDS = /(^|[^a-z])(lon|lng|long|longitude)([^a-z]|$)/i;

let lastCoordinate = null;

function validCoordinate(latitude, longitude) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

function withHemisphere(value, hemisphere) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return /[SW]/i.test(hemisphere) ? -Math.abs(number) : Math.abs(number);
}

function dmsValue(degrees, minutes, seconds, hemisphere) {
  const value = Number(degrees) + Number(minutes) / 60 + Number(seconds) / 3600;
  return withHemisphere(value, hemisphere);
}

function parseCoordinateText(value) {
  let text = String(value || "").replace(/[\u00a0]/g, " ");
  try { text = decodeURIComponent(text); } catch {}

  let match = text.match(/([-+]?\d{1,3}(?:\.\d+)?)_([NS])_([-+]?\d{1,3}(?:\.\d+)?)_([EW])/i);
  if (match) {
    const latitude = withHemisphere(match[1], match[2]);
    const longitude = withHemisphere(match[3], match[4]);
    return validCoordinate(latitude, longitude) ? { latitude, longitude } : null;
  }

  match = text.match(/(\d{1,3})_(\d{1,2})_([\d.]+)_([NS])_(\d{1,3})_(\d{1,2})_([\d.]+)_([EW])/i);
  if (match) {
    const latitude = dmsValue(match[1], match[2], match[3], match[4]);
    const longitude = dmsValue(match[5], match[6], match[7], match[8]);
    return validCoordinate(latitude, longitude) ? { latitude, longitude } : null;
  }

  const dmsPattern = /(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′]\s*([\d.]+)\s*["″]?\s*([NS])\s*[,;/ ]+\s*(\d{1,3})\s*[°º]\s*(\d{1,2})\s*['′]\s*([\d.]+)\s*["″]?\s*([EW])/i;
  match = text.match(dmsPattern);
  if (match) {
    const latitude = dmsValue(match[1], match[2], match[3], match[4]);
    const longitude = dmsValue(match[5], match[6], match[7], match[8]);
    return validCoordinate(latitude, longitude) ? { latitude, longitude } : null;
  }

  const ddmPattern = /(\d{1,3})\s*[°º]\s*([\d.]+)\s*['′]\s*([NS])\s*[,;/ ]+\s*(\d{1,3})\s*[°º]\s*([\d.]+)\s*['′]\s*([EW])/i;
  match = text.match(ddmPattern);
  if (match) {
    const latitude = withHemisphere(Number(match[1]) + Number(match[2]) / 60, match[3]);
    const longitude = withHemisphere(Number(match[4]) + Number(match[5]) / 60, match[6]);
    return validCoordinate(latitude, longitude) ? { latitude, longitude } : null;
  }

  const cardinalPattern = /([-+]?\d{1,3}(?:\.\d+)?)\s*([NS])\s*[,;/ ]+\s*([-+]?\d{1,3}(?:\.\d+)?)\s*([EW])/i;
  match = text.match(cardinalPattern);
  if (match) {
    const latitude = withHemisphere(match[1], match[2]);
    const longitude = withHemisphere(match[3], match[4]);
    return validCoordinate(latitude, longitude) ? { latitude, longitude } : null;
  }

  const decimalPattern = /([-+]?\d{1,3}(?:\.\d+)?)\s*[,;|/~]\s*([-+]?\d{1,3}(?:\.\d+)?)/;
  match = text.match(decimalPattern);
  if (match) {
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    return validCoordinate(latitude, longitude) ? { latitude, longitude } : null;
  }

  return null;
}

function coordinateFromUrl(value) {
  if (!value) return null;
  let decoded = String(value);
  try { decoded = decodeURIComponent(decoded); } catch {}

  const geohack = parseCoordinateText(decoded);
  if (geohack) return geohack;

  try {
    const url = new URL(value, location.href);
    const params = url.searchParams;
    const separate = parseCoordinateText(`${params.get("mlat") || ""},${params.get("mlon") || ""}`);
    if (separate) return separate;
    for (const key of ["q", "query", "ll", "center", "coord", "coordinates", "cp"]) {
      const parsed = parseCoordinateText(params.get(key));
      if (parsed) return parsed;
    }
    const mapHash = url.hash.match(/(?:map=\d+\/)?([-+]?\d{1,3}(?:\.\d+)?)\/([-+]?\d{1,3}(?:\.\d+)?)/);
    if (mapHash) return parseCoordinateText(`${mapHash[1]},${mapHash[2]}`);
  } catch {}

  return null;
}

function coordinateFromPageMetadata(target) {
  const scope = target instanceof Element
    ? target.closest(".geo, [itemtype*='GeoCoordinates']")
    : null;
  if (scope) {
    const latitude = scope.querySelector(".latitude, [itemprop='latitude'], geo\\:lat")?.textContent;
    const longitude = scope.querySelector(".longitude, [itemprop='longitude'], geo\\:long")?.textContent;
    const pair = parseCoordinateText(`${latitude || ""},${longitude || ""}`);
    if (pair) return pair;
  }

  const icbm = document.querySelector("meta[name='ICBM']")?.content;
  const geoPosition = document.querySelector("meta[name='geo.position']")?.content;
  return parseCoordinateText(icbm || geoPosition || "");
}

function numbersFrom(text) {
  return String(text || "")
    .match(NUMBER_PATTERN)
    ?.map(Number)
    .filter(Number.isFinite) || [];
}

function readableAttributes(element) {
  if (!(element instanceof Element)) return "";
  return [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.getAttribute("name"),
    element.getAttribute("id"),
    element.getAttribute("data-label"),
    element.getAttribute("data-field"),
    element.getAttribute("class")
  ].filter(Boolean).join(" ");
}

function nearbyLabel(element) {
  const parent = element.parentElement;
  const label = element.closest("label");
  const previous = element.previousElementSibling;
  const previousLabel = previous?.matches("label, [role=label]") ? previous.textContent : "";

  return [
    readableAttributes(element),
    label?.textContent,
    previousLabel,
    readableAttributes(parent)
  ].filter(Boolean).join(" ");
}

function classify(value, label) {
  const text = String(label || "");
  if (LATITUDE_WORDS.test(text) && Math.abs(value) <= 90) return "latitude";
  if (LONGITUDE_WORDS.test(text) && Math.abs(value) <= 180) return "longitude";
  return null;
}

function scopeFor(target) {
  let current = target instanceof Element ? target : document.body;
  let best = current;

  for (let level = 0; current && level < 6; level += 1, current = current.parentElement) {
    const count = numbersFrom(current.innerText || current.textContent).length;
    if (count >= 2 && count <= 12) best = current;
  }

  return best;
}

function candidatesIn(scope, target) {
  const elements = [scope, ...scope.querySelectorAll("*")];
  const candidates = [];

  for (const element of elements) {
    if (!(element instanceof Element)) continue;
    const raw = element.matches("input, textarea, select")
      ? element.value
      : element.childElementCount === 0 ? element.textContent : "";
    const values = numbersFrom(raw);
    if (values.length !== 1) continue;

    const value = values[0];
    if (Math.abs(value) > 180) continue;
    const label = `${readableAttributes(element)} ${nearbyLabel(element)}`;
    const kind = classify(value, label);
    const distance = element === target || element.contains(target) || target.contains(element) ? 0 : 1;
    const rect = element.getBoundingClientRect();
    if (!rect.width && !rect.height) continue;
    candidates.push({
      value,
      kind,
      distance,
      element,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2
    });
  }

  return candidates;
}

function findCoordinate(target, pointerX, pointerY) {
  const link = target instanceof Element ? target.closest("a[href]") : null;
  const linkedCoordinate = coordinateFromUrl(link?.href);
  if (linkedCoordinate) return linkedCoordinate;

  const visibleCoordinate = parseCoordinateText(target instanceof Element
    ? target.innerText || target.textContent
    : "");
  if (visibleCoordinate) return visibleCoordinate;

  const metadataCoordinate = coordinateFromPageMetadata(target);
  if (metadataCoordinate) return metadataCoordinate;

  let scope = target instanceof Element ? target : document.body;
  for (let level = 0; scope && level < 8; level += 1, scope = scope.parentElement) {
    const candidates = candidatesIn(scope, target);
    const latitude = candidates.find((candidate) => candidate.kind === "latitude");
    const longitude = candidates.find((candidate) => candidate.kind === "longitude");

    if (latitude && longitude) {
      return { latitude: latitude.value, longitude: longitude.value };
    }
  }

  const broadScope = scopeFor(target);
  const candidates = candidatesIn(broadScope, target);

  // Without labels, only use the nearest two values in the same small scope.
  const nearby = candidates.filter((candidate) => candidate.distance === 0 || candidate.element.parentElement === target.parentElement);
  if (nearby.length === 2) {
    const values = nearby.map((candidate) => candidate.value);
    if (Math.abs(values[0]) <= 90 && Math.abs(values[1]) <= 180) {
      return { latitude: values[0], longitude: values[1] };
    }
    if (Math.abs(values[1]) <= 90 && Math.abs(values[0]) <= 180) {
      return { latitude: values[1], longitude: values[0] };
    }
  }

  // Last resort for table-style pages: pair the two visible numbers closest
  // to the clicked field, favoring values in the same screen column.
  const allCandidates = candidatesIn(document.body, target);
  const targetRect = target instanceof Element ? target.getBoundingClientRect() : null;
  const clickX = Number.isFinite(pointerX)
    ? pointerX
    : targetRect ? targetRect.left + targetRect.width / 2 : 0;
  const clickY = Number.isFinite(pointerY)
    ? pointerY
    : targetRect ? targetRect.top + targetRect.height / 2 : 0;
  let best = null;

  for (const first of allCandidates) {
    for (const second of allCandidates) {
      if (first === second) continue;
      const firstIsLatitude = Math.abs(first.value) <= 90;
      const secondIsLongitude = Math.abs(second.value) <= 180;
      if (!firstIsLatitude || !secondIsLongitude) continue;

      const clickDistance = Math.hypot(first.centerX - clickX, first.centerY - clickY)
        + Math.hypot(second.centerX - clickX, second.centerY - clickY);
      const columnDistance = Math.abs(first.centerX - second.centerX);
      const rowDistance = Math.abs(first.centerY - second.centerY);
      const targetBonus = first.distance === 0 || second.distance === 0 ? 500 : 0;
      const score = clickDistance + columnDistance * 2 + rowDistance * 0.15 - targetBonus;

      if (!best || score < best.score) {
        best = { score, latitude: first.value, longitude: second.value };
      }
    }
  }

  if (best) return { latitude: best.latitude, longitude: best.longitude };

  return null;
}

document.addEventListener("contextmenu", (event) => {
  lastCoordinate = findCoordinate(event.target, event.clientX, event.clientY);
  chrome.runtime.sendMessage({ type: "geo-context", coordinate: lastCoordinate });
}, true);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type !== "get-geo-context") return;
  sendResponse({ coordinate: lastCoordinate });
});

// Keep the variable alive for browser consoles and make the intent explicit.
void lastCoordinate;
