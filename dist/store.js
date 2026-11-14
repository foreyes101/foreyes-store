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
  later: "Provide prescription later",
  sample: "Use a sample prescription",
};
const currency = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });
const money = amount => currency.format(amount);
const get = selector => document.querySelector(selector);

const products = get("#products");
const productDialog = get("#product-dialog");
const bagDialog = get("#bag-dialog");
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
let configuredFrame = null;
let bagStage = "bag";
let lastOrder = null;
let bag = restoreBag();

function restoreBag() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter(item =>
      item && frames.some(frame => frame.id === item.frameId) &&
      Object.hasOwn(lenses, item.lens) && Object.hasOwn(prescriptionChoices, item.prescription) &&
      Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= maxQuantity
    );
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
      <button class="card-trigger" type="button" data-frame="${frame.id}" aria-label="Configure ${frame.name} in ${frame.color}">
        <img src="assets/${frame.id}.jpg" width="512" height="512" alt="" loading="lazy">
        <span class="card-arrow" aria-hidden="true">↗</span>
      </button>
      <div class="card-title"><h3>${frame.name}</h3><p>${money(frame.price)}</p></div>
      <p class="card-meta"><span class="swatch" style="--swatch:${frame.swatch}"></span>${frame.color} · ${frame.fit}</p>
    </article>
  `).join("");
}

function openFrame(frame) {
  configuredFrame = frame;
  productDialog.innerHTML = `
    <div class="product-sheet">
      <div class="product-photo"><img src="assets/${frame.id}.jpg" alt="${frame.name} eyeglasses in ${frame.color}"></div>
      <div class="product-content">
        <button type="button" data-close class="close" aria-label="Close frame details">×</button>
        <p class="eyebrow">${frame.shape} · ${frame.fit} fit</p>
        <h2 id="product-title" class="dialog-title">${frame.name} in ${frame.color}</h2>
        <p>${frame.description}</p>
        <p class="hint" title="Lens width, bridge width, temple length">Frame measurements · ${frame.dimensions} mm</p>
        <form class="config">
          <label>Lens type
            <select name="lens">
              <option value="single">Single vision · Included</option>
              <option value="progressive">Progressive · +${money(lenses.progressive.extra)}</option>
            </select>
          </label>
          <label>Prescription
            <select name="prescription">
              <option value="later">${prescriptionChoices.later}</option>
              <option value="sample">${prescriptionChoices.sample}</option>
            </select>
          </label>
          <p class="hint" data-rx-hint>In a live store, you’d receive secure instructions after checkout.</p>
          <button class="button" type="submit">Add to bag <span data-config-price>${money(frame.price)}</span></button>
          <p class="hint" role="status" data-config-status hidden></p>
        </form>
      </div>
    </div>
  `;
  productDialog.showModal();
}

function pricePerPair(item) {
  return frames.find(frame => frame.id === item.frameId).price + lenses[item.lens].extra;
}

function subtotal() {
  return bag.reduce((sum, item) => sum + pricePerPair(item) * item.quantity, 0);
}

function bagLine(item, index) {
  const frame = frames.find(entry => entry.id === item.frameId);
  return `
    <article class="bag-item">
      <img src="assets/${frame.id}.jpg" alt="">
      <div>
        <div class="bag-item-title"><h3>${frame.name} in ${frame.color}</h3><strong>${money(pricePerPair(item) * item.quantity)}</strong></div>
        <p class="hint">${lenses[item.lens].label} · ${prescriptionChoices[item.prescription]}</p>
        <div class="quantity">
          <button type="button" data-action="less" data-index="${index}" aria-label="Decrease ${frame.name} quantity" ${item.quantity === 1 ? "disabled" : ""}>−</button>
          <span aria-label="Quantity ${item.quantity}">${item.quantity}</span>
          <button type="button" data-action="more" data-index="${index}" aria-label="Increase ${frame.name} quantity" ${item.quantity === maxQuantity ? "disabled" : ""}>+</button>
          <button type="button" class="text-link" data-action="remove" data-index="${index}" aria-label="Remove ${frame.name} from bag">Remove</button>
        </div>
      </div>
    </article>
  `;
}

function renderBag() {
  const title = { bag: "Your bag", checkout: "Review sample order", complete: "Sample order complete" }[bagStage];
  let content;
  let actions = "";

  if (bagStage === "complete") {
    content = `
      <p>You’ve finished the preview checkout. No payment was collected and no order will ship.</p>
      <div class="order-summary"><p>${lastOrder.count} ${lastOrder.count === 1 ? "pair" : "pairs"} · ${money(lastOrder.total)} CAD</p></div>
      <button class="button" type="button" data-close>Keep browsing</button>
    `;
  } else if (bagStage === "checkout") {
    content = `
      <p>This checkout simulates a purchase. It does not collect personal information or payment.</p>
      <div class="order-summary">${bag.map(item => {
        const frame = frames.find(entry => entry.id === item.frameId);
        return `<p>${item.quantity} × ${frame.name} in ${frame.color}<br><span class="hint">${lenses[item.lens].label} · ${prescriptionChoices[item.prescription]}</span></p>`;
      }).join("")}</div>
      <button class="text-link" type="button" data-action="back">Back to bag</button>
    `;
    actions = `
      <p class="total"><strong>Sample subtotal</strong><strong>${money(subtotal())} CAD</strong></p>
      <p class="hint">Shipping and taxes are outside this simulation.</p>
      <button type="button" class="button" data-action="complete">Place sample order</button>
    `;
  } else if (bag.length) {
    content = bag.map(bagLine).join("");
    actions = `
      <p class="total"><strong>Subtotal</strong><strong>${money(subtotal())} CAD</strong></p>
      <p class="hint">This is a store preview. No payment is collected.</p>
      <button type="button" class="button" data-action="checkout">Try checkout <span aria-hidden="true">↗</span></button>
    `;
  } else {
    content = '<p>Your bag is empty.</p><button class="button" type="button" data-close>Keep browsing</button>';
  }

  bagDialog.innerHTML = `
    <div class="drawer-inner">
      <div class="drawer-header"><h2 id="bag-title" class="dialog-title" tabindex="-1">${title}</h2><button class="close" type="button" data-close aria-label="Close bag">×</button></div>
      <div class="drawer-main">${content}</div>
      ${actions ? `<div class="drawer-bottom">${actions}</div>` : ""}
    </div>
  `;
}

function openBag() {
  bagStage = "bag";
  renderBag();
  bagDialog.showModal();
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
  get("#shop").scrollIntoView();
});

clearSearch.addEventListener("click", () => {
  query = "";
  search.value = "";
  renderFrames();
  filters.querySelector('[aria-pressed="true"]').focus();
});

products.addEventListener("click", event => {
  const trigger = event.target.closest("[data-frame]");
  if (trigger) openFrame(frames.find(frame => frame.id === trigger.dataset.frame));
});

productDialog.addEventListener("change", event => {
  const form = event.target.form;
  if (!form) return;
  const lens = form.elements.lens.value;
  get("[data-config-price]").textContent = money(configuredFrame.price + lenses[lens].extra);
  get("[data-rx-hint]").textContent = form.elements.prescription.value === "sample"
    ? "A sample prescription choice will be saved with this pair. No file is needed."
    : "In a live store, you’d receive secure instructions after checkout.";
  get("[data-config-status]").hidden = true;
});

productDialog.addEventListener("submit", event => {
  event.preventDefault();
  const data = new FormData(event.target);
  const entry = { frameId: configuredFrame.id, lens: data.get("lens"), prescription: data.get("prescription"), quantity: 1 };
  const existing = bag.find(item => item.frameId === entry.frameId && item.lens === entry.lens && item.prescription === entry.prescription);

  if (existing?.quantity === maxQuantity) {
    const status = get("[data-config-status]");
    status.textContent = `This configuration already has ${maxQuantity} pairs in your bag.`;
    status.hidden = false;
    return;
  }

  if (existing) existing.quantity++;
  else bag.push(entry);
  persistBag();
  productDialog.close();
  openBag();
});

bagButton.addEventListener("click", openBag);
bagDialog.addEventListener("click", event => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const { action, index } = button.dataset;
  const item = bag[index];

  if (action === "more" && item && item.quantity < maxQuantity) item.quantity++;
  if (action === "less" && item && item.quantity > 1) item.quantity--;
  if (action === "remove" && item) bag.splice(Number(index), 1);
  if (action === "checkout" && bag.length) bagStage = "checkout";
  if (action === "back") bagStage = "bag";
  if (action === "complete" && bagStage === "checkout" && bag.length) {
    lastOrder = { total: subtotal(), count: bag.reduce((sum, entry) => sum + entry.quantity, 0) };
    bag = [];
    bagStage = "complete";
  }

  persistBag();
  renderBag();
  const equivalentButton = index === undefined || action === "remove" ? null : bagDialog.querySelector(`[data-action="${action}"][data-index="${index}"]:not(:disabled)`);
  (equivalentButton || get("#bag-title")).focus();
});

for (const dialog of [productDialog, bagDialog]) {
  dialog.addEventListener("click", event => {
    if (event.target.closest("[data-close]") || event.target === dialog) dialog.close();
  });
}

updateBagCount();
renderFrames();
