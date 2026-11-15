"use strict";

const frames = [
  { id: "ellis", name: "Ellis", color: "Ink", swatch: "#21211f", shape: "Rectangle", fit: "Narrow", dimensions: "49–19–140", price: 125, description: "A slim rectangle with a low profile and softly rounded corners." },
  { id: "arden", name: "Arden", color: "Tortoise", swatch: "#7a462b", shape: "Square", fit: "Medium", dimensions: "51–20–145", price: 145, description: "A soft square with a warm tortoiseshell finish." },
  { id: "noor", name: "Noor", color: "Olive", swatch: "#778149", shape: "Round", fit: "Medium", dimensions: "48–21–145", price: 135, description: "A rounded frame in translucent olive with a gently raised bridge." },
  { id: "milo", name: "Milo", color: "Amber", swatch: "#a97139", shape: "Rectangle", fit: "Wide", dimensions: "54–18–150", price: 145, description: "An easy, wide rectangle in translucent honey amber." },
  { id: "remy", name: "Remy", color: "Espresso", swatch: "#4b302a", shape: "Round", fit: "Medium", dimensions: "50–21–145", price: 155, description: "A substantial rounded silhouette in deep espresso." },
  { id: "theo", name: "Theo", color: "Sand", swatch: "#c3a684", shape: "Geometric", fit: "Narrow", dimensions: "48–19–140", price: 135, description: "Light translucent acetate with an angular profile and soft edges." },
];

const lenses = {
  single: { label: "Single vision", extra: 0 },
  progressive: { label: "Progressive", extra: 110 },
};
const prescriptionChoices = {
  manual: "Enter prescription manually",
  later: "Provide prescription later",
  sample: "Use a sample prescription",
};
const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const money = amount => currency.format(amount);
const get = selector => document.querySelector(selector);

const products = get("#products");
const bagButton = get("#open-bag");
const searchPanel = get("#search-panel");
const searchToggle = get("#search-toggle");
const search = get("#search");
const filters = get("#filters");
const sort = get("#sort");
const clearSearch = get("#clear-search");
const storageKey = "foreyes-preview-bag-v1";
const maxQuantity = 9;

let selectedShape = "All";
let query = "";
const comparison = new Set();
let bag = restoreBag();

function restoreBag() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(item =>
      item && frames.some(frame => frame.id === item.frameId) &&
      Object.hasOwn(lenses, item.lens) && Object.hasOwn(prescriptionChoices, item.prescription) &&
      Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= maxQuantity
    ).map(({ frameId, lens, prescription, quantity, rxId }) => ({
      frameId, lens, prescription, quantity,
      ...(prescription === "manual" ? { rxId: /^[0-9a-f-]{36}$/.test(rxId) ? rxId : crypto.randomUUID() } : {}),
    }));
  } catch {
    return [];
  }
}

function persistBag() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(bag));
  } catch {
    // The bag still works in memory if this browser blocks local storage.
  }
  updateBagCount();
}

function updateBagCount() {
  const count = bag.reduce((sum, item) => sum + item.quantity, 0);
  get("#bag-count").textContent = count;
  bagButton.setAttribute("aria-label", `Open shopping bag, ${count} ${count === 1 ? "item" : "items"}`);
}

function renderFrames() {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = frames.filter(frame => {
    const keywords = `${frame.name} ${frame.color} ${frame.shape} ${frame.fit} ${frame.description}`.toLowerCase();
    return (selectedShape === "All" || frame.shape === selectedShape) && terms.every(term => keywords.includes(term));
  });

  if (sort.value === "ascending") matches.sort((a, b) => a.price - b.price);
  if (sort.value === "descending") matches.sort((a, b) => b.price - a.price);
  if (sort.value === "name") matches.sort((a, b) => a.name.localeCompare(b.name));

  get("#result-count").textContent = `${matches.length} ${matches.length === 1 ? "frame" : "frames"}${query ? ` matching “${query}”` : ""}`;
  clearSearch.hidden = !query;

  if (!matches.length) {
    products.innerHTML = '<p class="empty">No frames match. Try a different search or shape.</p>';
    return;
  }

  products.innerHTML = matches.map(frame => `
    <article class="card">
      <a class="card-trigger" href="#frame/${frame.id}" aria-label="View ${frame.name} in ${frame.color}">
        <img src="assets/${frame.id}.jpg" width="512" height="288" alt="" loading="lazy">
      </a>
      <div class="card-title"><h3>${frame.name}</h3><p>${money(frame.price)}</p></div>
      <p class="card-meta"><span class="swatch" style="--swatch:${frame.swatch}"></span>${frame.color} · ${frame.fit} fit</p>
      <button class="compare-toggle" type="button" data-compare="${frame.id}" aria-pressed="${comparison.has(frame.id)}" aria-label="Compare ${frame.name}">Compare</button>
    </article>
  `).join("");
}

function pricePerPair(item) {
  return frames.find(frame => frame.id === item.frameId).price + lenses[item.lens].extra;
}

function subtotal() {
  return bag.reduce((sum, item) => sum + pricePerPair(item) * item.quantity, 0);
}

filters.addEventListener("click", event => {
  const button = event.target.closest("button[data-shape]");
  if (!button) return;
  selectedShape = button.dataset.shape;
  filters.querySelectorAll("button").forEach(filter => filter.setAttribute("aria-pressed", String(filter === button)));
  renderFrames();
});

sort.addEventListener("change", renderFrames);
searchToggle.addEventListener("click", () => {
  searchPanel.hidden = !searchPanel.hidden;
  searchToggle.setAttribute("aria-expanded", String(!searchPanel.hidden));
  if (!searchPanel.hidden) search.focus();
});

searchPanel.addEventListener("submit", event => {
  event.preventDefault();
  query = search.value.trim();
  selectedShape = "All";
  filters.querySelectorAll("button").forEach(filter => filter.setAttribute("aria-pressed", String(filter.dataset.shape === "All")));
  renderFrames();
  searchPanel.hidden = true;
  searchToggle.setAttribute("aria-expanded", "false");
  if (location.hash === "#shop") get("#shop").scrollIntoView();
  else location.hash = "shop";
});

clearSearch.addEventListener("click", () => {
  query = "";
  search.value = "";
  renderFrames();
  filters.querySelector('[aria-pressed="true"]').focus();
});

updateBagCount();
renderFrames();
