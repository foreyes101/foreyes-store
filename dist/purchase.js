"use strict";

const storefront = get("#storefront");
const purchasePage = get("#purchase-page");
const steps = ["lenses", "prescription", "review"];
const stageLabels = ["Lenses", "Prescription", "Review"];
const lensDescriptions = {
  single: "One prescription across the lens, typically for distance or reading.",
  progressive: "Multiple viewing distances in one lens. Additional fitting measurements may be needed.",
};
const prescriptionDescriptions = {
  manual: "Enter sphere power and any other measurements from an example glasses prescription.",
  later: "Preview the flow for sending your prescription securely after checkout.",
  sample: "Try the builder using example information.",
};
const cad = amount => money(amount) + " CAD";
const findFrame = id => frames.find(frame => frame.id === id);
const itemKey = item => [item.frameId, item.lens, item.prescription, item.rxId].filter(Boolean).join("/");
const measurements = ["Lens width", "Bridge width", "Temple length"];
let draft = readSession("foreyes-preview-draft");
let draftRx = {};
const bagPrescriptions = new Map();
let lastOrder = readSession("foreyes-preview-order");

function readSession(key) {
  try {
    return JSON.parse(sessionStorage.getItem(key));
  } catch {
    return null;
  }
}

function saveSession(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Continue in memory when session storage is unavailable.
  }
}

function stepLink(frame, step, editKey = "") {
  return `#build/${frame.id}/${step}${editKey ? "/" + editKey : ""}`;
}

function backLink(route, title) {
  return `<a class="back-link" href="${route}"><span aria-hidden="true">←</span> ${title}</a>`;
}

function frameImage(frame, alt = "") {
  return `<img src="assets/${frame.id}.jpg" width="512" height="288" alt="${alt}">`;
}

function measurementList(frame) {
  return `<dl class="frame-measurements">${frame.dimensions.split("–").map((value, index) =>
    `<div><dt>${measurements[index]}</dt><dd>${value} mm</dd></div>`
  ).join("")}</dl>`;
}

function framePage(frame) {
  return `${backLink("#shop", "All frames")}
    <div class="frame-layout">
      <figure class="frame-figure">${frameImage(frame, frame.name + " prescription glasses in " + frame.color)}</figure>
      <section class="frame-info">
        <p class="eyebrow">${frame.shape} · ${frame.fit} fit</p>
        <h1 id="page-title" tabindex="-1">${frame.name}<span> in ${frame.color}</span></h1>
        <p class="frame-price">${cad(frame.price)} <span>with single vision lenses</span></p>
        <p>${frame.description}</p>
        <a class="button purchase-button" href="${stepLink(frame, "lenses")}">Build your glasses <span aria-hidden="true">↗</span></a>
        <div class="frame-fit">
          <h2>Check the fit</h2>
          ${measurementList(frame)}
          <details><summary>Compare with your current glasses</summary><p class="hint">Look inside the arm of a pair you already own. The three numbers often printed there are the lens width, bridge width, and temple length in millimetres.</p></details>
        </div>
        <p class="hint">Sample frame and measurements</p>
      </section>
    </div>`;
}

function initDraft(frame, editKey, original) {
  if (draft?.frameId === frame.id && draft.editKey === editKey &&
      Object.hasOwn(lenses, draft.lens) && Object.hasOwn(prescriptionChoices, draft.prescription)) return;
  draft = {
    frameId: frame.id,
    editKey,
    lens: original?.lens || "single",
    prescription: original?.prescription || "later",
  };
  draftRx = { ...bagPrescriptions.get(original?.rxId) };
  saveSession("foreyes-preview-draft", draft);
}

function choiceCards(name, choices, descriptions) {
  return Object.entries(choices).map(([value, choice]) => `
    <label class="choice">
      <input type="radio" name="${name}" value="${value}" ${draft[name] === value ? "checked" : ""}>
      <span class="choice-copy"><strong>${choice.label || choice}</strong><span>${descriptions[value]}</span></span>
      ${name === "lens" ? `<span class="choice-cost">${choice.extra ? "+" + money(choice.extra) : "Included"}</span>` : ""}
    </label>`).join("");
}

function builderSummary(frame, step, quantity) {
  return `<aside class="purchase-summary builder-summary" aria-label="Your glasses">
    ${frameImage(frame)}
    <div class="summary-body">
      <h2>${frame.name} in ${frame.color}</h2>
      <p class="hint">${frame.fit} fit${quantity > 1 ? ` · ${quantity} pairs` : ""}</p>
      <dl class="summary-rows">
        <div><dt>Frame + single vision</dt><dd>${money(frame.price)}</dd></div>
        <div><dt data-lens-label>${lenses[draft.lens].label}</dt><dd data-lens-cost>${lenses[draft.lens].extra ? "+" + money(lenses[draft.lens].extra) : "Included"}</dd></div>
        ${step === "lenses" ? "" : `<div><dt>Prescription</dt><dd data-rx-label>${prescriptionChoices[draft.prescription]}</dd></div>`}
      </dl>
      <div class="total"><strong>Subtotal</strong><strong data-builder-total aria-live="polite">${cad(pricePerPair(draft) * quantity)}</strong></div>
    </div>
  </aside>`;
}

function builderPage(frame, step, editKey, original) {
  const index = steps.indexOf(step);
  const title = ["Choose your lenses", "How will you provide your prescription?", "Review your glasses"][index];
  const previous = index ? stepLink(frame, steps[index - 1], editKey) : editKey ? "#bag" : "#frame/" + frame.id;
  const previousLabel = index ? stageLabels[index - 1] : editKey ? "Back to bag" : "Back to " + frame.name;
  const options = [
    `<fieldset><legend class="sr-only">Lens type</legend>${choiceCards("lens", lenses, lensDescriptions)}</fieldset>`,
    `<fieldset><legend class="sr-only">Prescription submission</legend>${choiceCards("prescription", prescriptionChoices, prescriptionDescriptions)}</fieldset>
      ${prescriptionForm(draft.prescription === "manual")}`,
    `<dl class="review-options">
       <div><dt>Lens type</dt><dd>${lenses[draft.lens].label}</dd><dd><a class="text-link" href="${stepLink(frame, "lenses", editKey)}" aria-label="Edit lens type">Edit</a></dd></div>
       <div><dt>Prescription</dt><dd>${prescriptionChoices[draft.prescription]}</dd><dd><a class="text-link" href="${stepLink(frame, "prescription", editKey)}" aria-label="Edit prescription choice">Edit</a></dd></div>
     </dl>${step === "review" && draft.prescription === "manual" ? prescriptionReadback(validatePrescription(draftRx, draft.lens).data) : ""}`,
  ][index];
  const lead = [
    "Choose the type that matches your prescription.",
    "Enter an example prescription now, use a sample, or choose to provide it later.",
    "Check your lens and prescription choices before saving this pair.",
  ][index];
  const continueLabel = ["Continue to prescription", "Review my glasses", editKey ? "Save changes" : "Add to bag"][index];

  return `${backLink(previous, previousLabel)}
    <ol class="purchase-steps" aria-label="Glasses builder progress">${steps.map((name, position) =>
      `<li ${name === step ? 'aria-current="step"' : ""} class="${position < index ? "step-complete" : ""}"><span>${position + 1}</span>${stageLabels[position]}</li>`
    ).join("")}</ol>
    <div class="purchase-layout">
      <section>
        <h1 id="page-title" tabindex="-1">${title}</h1>
        <p class="page-intro">${lead}</p>
        <form id="builder-form" data-step="${step}" autocomplete="off" novalidate>
          ${options}
          <p id="builder-error" role="alert" class="form-error" hidden></p>
          <button class="button purchase-button" type="submit" ${step === "review" && cartBlocked() ? "disabled" : ""}>${continueLabel} <span aria-hidden="true">→</span></button>
          <p class="mobile-subtotal">Subtotal <strong data-mobile-total>${cad(pricePerPair(draft) * (original?.quantity || 1))}</strong></p>
        </form>
      </section>
      ${builderSummary(frame, step, original?.quantity || 1)}
    </div>`;
}

function orderLine(item, index, editable) {
  const frame = findFrame(item.frameId);
  const editKey = itemKey(item).slice(frame.id.length + 1);
  const rx = bagPrescriptions.get(item.rxId);
  return `<article class="order-line">
    <a class="order-thumb" href="#frame/${frame.id}" aria-label="View ${frame.name}">${frameImage(frame)}</a>
    <div>
      <div class="order-line-title"><h2>${frame.name} in ${frame.color}</h2><strong>${money(pricePerPair(item) * item.quantity)}</strong></div>
      <p class="hint">${lenses[item.lens].label} · ${item.prescription === "manual" ? rx ? "Prescription entered" : "Prescription needs re-entry" : prescriptionChoices[item.prescription]}</p>
      ${editable ? `<div class="order-actions">
        <div class="quantity-picker" aria-label="Quantity">
          <button type="button" data-quantity="less" data-index="${index}" aria-label="Decrease ${frame.name} quantity" ${item.quantity === 1 || cartBlocked() ? "disabled" : ""}>−</button>
          <span>${item.quantity}</span>
          <button type="button" data-quantity="more" data-index="${index}" aria-label="Increase ${frame.name} quantity" ${item.quantity === maxQuantity || cartBlocked() ? "disabled" : ""}>+</button>
        </div>
        <a href="${stepLink(frame, item.prescription === "manual" && !rx ? "prescription" : "lenses", editKey)}" class="text-link" data-edit aria-label="Edit ${frame.name} configuration">${item.prescription === "manual" && !rx ? "Re-enter prescription" : "Edit"}</a>
        <button type="button" class="text-link" data-quantity="remove" data-index="${index}" aria-label="Remove ${frame.name} from bag" ${cartBlocked() ? "disabled" : ""}>Remove</button>
      </div>` : `<p class="hint">Quantity ${item.quantity}</p>
        ${rx ? `<details class="checkout-rx"><summary>Review entered prescription</summary>${prescriptionReadback(rx)}</details>` : ""}`}
    </div>
  </article>`;
}

function bagPage(checkout) {
  const title = checkout ? "Review your order" : "Your bag";
  const previous = checkout ? backLink("#bag", "Back to bag") : backLink("#shop", "Keep shopping");
  if (!bag.length && cartBlocked()) {
    return `${previous}<h1 id="page-title" tabindex="-1">${title}</h1>`;
  }
  if (!bag.length) {
    return `${backLink("#shop", "All frames")}<h1 id="page-title" tabindex="-1">Your bag is empty</h1>
      <p class="page-intro">Find a frame to start building your glasses.</p><a class="button purchase-button" href="#shop">Shop frames ↗</a>`;
  }

  const count = bag.reduce((sum, item) => sum + item.quantity, 0);
  const status = checkout ? "Sample checkout · No charge" : count + (count === 1 ? " pair" : " pairs");
  const missingRx = bag.some(item => item.prescription === "manual" && !bagPrescriptions.has(item.rxId));
  const actions = cartBlocked() ? "" : missingRx
    ? `<p class="hint">Re-enter the prescription for any marked pair before checkout. This preview clears entered values when you reload.</p>${checkout ? '<a class="button purchase-button" href="#bag">Back to bag</a>' : ""}`
    : checkout
    ? `<button type="button" class="button purchase-button" id="place-order">Place sample order <span aria-hidden="true">→</span></button>`
    : `<a class="button purchase-button" href="#checkout">Continue to checkout <span aria-hidden="true">→</span></a>`;
  return `${previous}<div class="purchase-layout">
    <section>
      <p class="eyebrow">${status}</p>
      <h1 id="page-title" tabindex="-1">${title}</h1>
      <div class="order-lines">${bag.map((item, index) => orderLine(item, index, !checkout)).join("")}</div>
      ${checkout ? `<div class="delivery-note"><h2>Delivery</h2><p>In the live shop, you’ll enter your address in Stripe Checkout. This preview uses a sample order and requires no personal information.</p></div>` : ""}
    </section>
    <aside class="purchase-summary" aria-label="Order summary">
      <div class="summary-body">
        <h2>Order summary</h2>
        <dl class="summary-rows">
          <div><dt>Items</dt><dd>${count}</dd></div>
          <div><dt>Shipping and taxes</dt><dd>Outside preview</dd></div>
        </dl>
        <div class="total"><strong>Subtotal</strong><strong aria-live="polite">${cad(subtotal())}</strong></div>
        ${actions}
      </div>
    </aside>
  </div>`;
}

function confirmationPage() {
  if (!lastOrder || typeof lastOrder.reference !== "string" || !/^DEMO-[A-Z0-9]{6}$/.test(lastOrder.reference) ||
      !Number.isFinite(lastOrder.total) || !Number.isInteger(lastOrder.count)) {
    return `${backLink("#shop", "All frames")}<h1 id="page-title" tabindex="-1">No sample order yet</h1><a class="button purchase-button" href="#bag">View bag →</a>`;
  }
  return `<section class="receipt">
    <span class="receipt-mark" aria-hidden="true">✓</span>
    <p class="eyebrow">${lastOrder.reference}</p>
    <h1 id="page-title" tabindex="-1">Sample order complete</h1>
    <p class="page-intro">You’ve finished the preview checkout. No payment was collected and no glasses will ship.</p>
    <dl class="summary-rows">
      <div><dt>Pairs</dt><dd>${lastOrder.count}</dd></div>
      <div><dt>Sample subtotal</dt><dd>${cad(lastOrder.total)}</dd></div>
      <div><dt>Prescription</dt><dd>${lastOrder.needsPrescription ? "Provide later (preview)" : lastOrder.enteredPrescription ? "Entered for preview" : "Sample selected"}</dd></div>
    </dl>
    ${lastOrder.needsPrescription ? `<p class="hint">In the live shop, this is where you’d get instructions to send your prescription securely.</p>` : ""}
    <a href="#shop" class="button purchase-button">Keep browsing <span aria-hidden="true">↗</span></a>
  </section>`;
}

function comparisonPage() {
  const cards = [...comparison].map(id => {
    const frame = findFrame(id);
    return `<article class="compare-card">
      <a href="#frame/${frame.id}">${frameImage(frame, frame.name + " in " + frame.color)}</a>
      <h2><a href="#frame/${frame.id}">${frame.name}</a></h2>
      <p class="hint">${frame.color} · ${frame.shape} · ${frame.fit} fit</p>
      ${measurementList(frame)}
      <p class="frame-price">${cad(frame.price)}</p>
      <a class="text-link" href="#frame/${frame.id}">View frame ↗</a>
      <button type="button" class="compare-toggle" data-compare="${frame.id}" aria-label="Remove ${frame.name} from comparison">Remove</button>
    </article>`;
  }).join("");
  return `${backLink("#shop", "All frames")}<h1 id="page-title" tabindex="-1">Compare frames</h1>
    <p class="page-intro">${comparison.size < 2 ? "Add two or three frames in the shop to compare them." : "Compare frame measurements and starting prices side by side."}</p>
    <div class="compare-grid">${cards}</div>`;
}

function comparisonToolbar(message = "") {
  get("#compare-strip").hidden = !comparison.size;
  get("#compare-link").hidden = comparison.size < 2;
  get("#compare-count").textContent = message || comparison.size + " of 3 frames selected";
  products.querySelectorAll("[data-compare]").forEach(button => {
    button.setAttribute("aria-pressed", String(comparison.has(button.dataset.compare)));
  });
}

function renderRoute(moveFocus = true) {
  const route = location.hash.slice(1);
  const [screen, frameId, step, editLens, editRx, rxId, ...rest] = route.split("/");
  const frame = findFrame(frameId);
  let content = "";

  if (screen === "frame" && frame && !step) content = framePage(frame);
  if (route === "bag" || route === "checkout") content = bagPage(route === "checkout");
  if (route === "order") content = confirmationPage();
  if (route === "compare") content = comparisonPage();
  if (route === "account") content = accountPage();

  if (screen === "build" && frame && steps.includes(step) && !rest.length) {
    const editKey = editLens && editRx ? [editLens, editRx, rxId].filter(Boolean).join("/") : "";
    const original = editKey && bag.find(item => itemKey(item) === frame.id + "/" + editKey);
    if (editKey && !original) {
      content = `${backLink("#bag", "Back to bag")}<h1 id="page-title" tabindex="-1">This pair isn’t in your bag</h1>`;
    } else {
      initDraft(frame, editKey, original);
      if (step === "review" && draft.prescription === "manual" && Object.keys(validatePrescription(draftRx, draft.lens).errors).length) {
        location.replace(stepLink(frame, "prescription", editKey));
        return;
      }
      content = builderPage(frame, step, editKey, original);
    }
  }

  storefront.hidden = Boolean(content);
  purchasePage.hidden = !content;
  purchasePage.innerHTML = content;
  if (get("#manual-rx")) fillPrescriptionForm(draftRx);
  if (route === "account") renderAccountDetails();
  comparisonToolbar();
  const title = get("#page-title");
  document.title = title ? title.textContent + " — Foreyes" : "Foreyes — Prescription eyewear";

  if (!moveFocus) return;
  if (title) title.focus({ preventScroll: true });
  const target = !title && (route === "shop" || route === "lenses") ? document.getElementById(route) : null;
  if (target) {
    const heading = target.querySelector("h2");
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    target.scrollIntoView();
  } else {
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}

function editedPair() {
  if (!draft.editKey) return null;
  return bag.find(item => itemKey(item) === draft.frameId + "/" + draft.editKey);
}

async function addOrUpdatePair() {
  if (cartBlocked()) return;
  const activeDraft = draft;
  const original = editedPair();
  const entry = { frameId: draft.frameId, lens: draft.lens, prescription: draft.prescription, quantity: original?.quantity || 1 };
  if (draft.prescription === "manual") {
    const { data, errors } = validatePrescription(draftRx, draft.lens);
    if (Object.keys(errors).length) {
      location.hash = stepLink(findFrame(draft.frameId), "prescription", draft.editKey);
      return;
    }
    entry.rxId = original?.rxId || crypto.randomUUID();
    bagPrescriptions.set(entry.rxId, data);
  }
  const matching = bag.find(item => item !== original && itemKey(item) === itemKey(entry));
  if (matching && matching.quantity + entry.quantity > maxQuantity) {
    const error = get("#builder-error");
    error.hidden = false;
    error.textContent = "You can add up to " + maxQuantity + " pairs with the same configuration. Adjust the quantity in your bag first.";
    return;
  }
  if (original?.rxId && !entry.rxId) bagPrescriptions.delete(original.rxId);
  if (matching) {
    matching.quantity += entry.quantity;
    if (original) bag.splice(bag.indexOf(original), 1);
  } else if (original) {
    bag[bag.indexOf(original)] = entry;
  } else {
    bag.push(entry);
  }
  if (!await persistBag() || draft !== activeDraft) return;
  draft = null;
  draftRx = {};
  saveSession("foreyes-preview-draft", draft);
  if (location.hash === stepLink(findFrame(activeDraft.frameId), "review", activeDraft.editKey)) location.hash = "bag";
}

purchasePage.addEventListener("submit", event => {
  const form = event.target;
  if (form.id !== "builder-form") return;
  event.preventDefault();
  if (!draft) return;
  const index = steps.indexOf(form.dataset.step);
  if (form.dataset.step === "prescription" && draft.prescription === "manual") {
    const { errors } = validatePrescription(draftRx, draft.lens);
    const inputs = form.querySelectorAll("[data-rx-input]");
    for (const input of inputs) {
      input.setCustomValidity(errors[input.dataset.rxInput] || "");
      if (errors[input.dataset.rxInput] && input.closest("details")) input.closest("details").open = true;
    }
    if (Object.keys(errors).length) {
      form.reportValidity();
      return;
    }
  }
  if (index === steps.length - 1) addOrUpdatePair();
  else location.hash = stepLink(findFrame(draft.frameId), steps[index + 1], draft.editKey);
});

purchasePage.addEventListener("input", event => {
  const input = event.target;
  const key = input.dataset.rxInput;
  if (!key) return;
  draftRx[key] = input.value;
  input.setCustomValidity("");
});

purchasePage.addEventListener("change", event => {
  const { id, name, value, form } = event.target;
  if (form?.id !== "builder-form") return;
  if (id === "pd-mode") {
    draftRx.pdMode = value;
    updatePdFields(value);
    return;
  }
  if (name !== "lens" && name !== "prescription") return;
  draft[name] = value;
  if (name === "prescription") {
    const panel = get("#manual-rx");
    panel.hidden = panel.disabled = value !== "manual";
  }
  saveSession("foreyes-preview-draft", draft);
  get("[data-lens-label]").textContent = lenses[draft.lens].label;
  get("[data-lens-cost]").textContent = lenses[draft.lens].extra ? "+" + money(lenses[draft.lens].extra) : "Included";
  const rxLabel = get("[data-rx-label]");
  if (rxLabel) rxLabel.textContent = prescriptionChoices[draft.prescription];
  const total = cad(pricePerPair(draft) * (editedPair()?.quantity || 1));
  get("[data-builder-total]").textContent = total;
  get("[data-mobile-total]").textContent = total;
});

document.addEventListener("click", async event => {
  const compare = event.target.closest("[data-compare]");
  if (compare) {
    const id = compare.dataset.compare;
    if (comparison.has(id)) comparison.delete(id);
    else if (comparison.size < 3) comparison.add(id);
    else {
      comparisonToolbar("Remove a frame before adding another.");
      return;
    }
    if (location.hash === "#compare") renderRoute();
    else comparisonToolbar();
    return;
  }

  if (event.target.closest("[data-edit]")) {
    draft = null;
    draftRx = {};
    saveSession("foreyes-preview-draft", draft);
    return;
  }

  const control = event.target.closest("[data-quantity]");
  if (control) {
    if (cartBlocked()) return;
    const { quantity, index } = control.dataset;
    const item = bag[index];
    if (!item) return;
    if (quantity === "more" && item.quantity < maxQuantity) item.quantity += 1;
    if (quantity === "less" && item.quantity > 1) item.quantity -= 1;
    if (quantity === "remove") {
      bag.splice(Number(index), 1);
      bagPrescriptions.delete(item.rxId);
    }
    persistBag();
    renderRoute(false);
    const next = quantity === "remove" ? null : get(`[data-quantity="${quantity}"][data-index="${index}"]:not(:disabled)`);
    (next || get("#page-title")).focus({ preventScroll: true });
  }

  if (event.target.closest("#place-order") && location.hash === "#checkout" && !cartBlocked() && bag.length &&
      bag.every(item => item.prescription !== "manual" || bagPrescriptions.has(item.rxId))) {
    const order = {
      reference: "DEMO-" + crypto.getRandomValues(new Uint8Array(3)).reduce((hex, byte) => hex + byte.toString(16).padStart(2, "0"), "").toUpperCase(),
      total: subtotal(),
      count: bag.reduce((sum, item) => sum + item.quantity, 0),
      needsPrescription: bag.some(item => item.prescription === "later"),
      enteredPrescription: bag.some(item => item.prescription === "manual"),
    };
    bag = [];
    if (!await persistBag()) return;
    lastOrder = order;
    saveSession("foreyes-preview-order", lastOrder);
    bagPrescriptions.clear();
    draftRx = {};
    if (location.hash === "#checkout") location.hash = "order";
  }
});

window.addEventListener("hashchange", () => renderRoute());
renderRoute(false);
