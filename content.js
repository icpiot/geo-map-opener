const NUMBER_PATTERN = /[-+]?\d+(?:\.\d+)?/g;
const LATITUDE_WORDS = /(^|[^a-z])(lat|latitude)([^a-z]|$)/i;
const LONGITUDE_WORDS = /(^|[^a-z])(lon|lng|long|longitude)([^a-z]|$)/i;

let lastCoordinate = null;

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
  if (!parent) return "";

  const siblingText = Array.from(parent.children)
    .filter((child) => child !== element)
    .map((child) => child.textContent.trim())
    .join(" ");

  return `${readableAttributes(element)} ${siblingText} ${readableAttributes(parent)}`;
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
    candidates.push({ value, kind, distance, element });
  }

  return candidates;
}

function findCoordinate(target) {
  const scope = scopeFor(target);
  const candidates = candidatesIn(scope, target);
  const latitude = candidates.find((candidate) => candidate.kind === "latitude");
  const longitude = candidates.find((candidate) => candidate.kind === "longitude");

  if (latitude && longitude) {
    return { latitude: latitude.value, longitude: longitude.value };
  }

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

  return null;
}

document.addEventListener("contextmenu", (event) => {
  lastCoordinate = findCoordinate(event.target);
  chrome.runtime.sendMessage({ type: "geo-context", coordinate: lastCoordinate });
}, true);

// Keep the variable alive for browser consoles and make the intent explicit.
void lastCoordinate;
