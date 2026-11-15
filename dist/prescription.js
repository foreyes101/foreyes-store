"use strict";

const rxEyes = [["od", "Right eye (OD)"], ["os", "Left eye (OS)"]];
const rxFields = [
  ["sph", "Sphere (SPH / power)", "−1.25"],
  ["cyl", "Cylinder (CYL)", "−0.50"],
  ["axis", "Axis (°)", "090"],
  ["add", "Near ADD", "+2.00"],
];
const prismDirections = {
  horizontal: [["in", "Base in"], ["out", "Base out"]],
  vertical: [["up", "Base up"], ["down", "Base down"]],
};

function rxInput(key, label, example, inputMode = "decimal") {
  return `<label class="rx-field"><span>${label}</span><input type="text" inputmode="${inputMode}" maxlength="12" placeholder="${example}" data-rx-input="${key}" autocomplete="off" spellcheck="false"></label>`;
}

function prescriptionForm(show) {
  return `<fieldset class="rx-panel" id="manual-rx" ${show ? "" : "hidden disabled"}>
    <legend class="sr-only">Manual prescription</legend>
    <p class="hint">Use fictional values for this preview. Keep the + or − sign as written. Enter 0 or PL for plano sphere. A reload clears these values.</p>
    <div class="rx-eyes">${rxEyes.map(([eye, label]) => `
      <fieldset class="rx-eye"><legend>${label}</legend>
        <div class="rx-grid">${rxFields.map(([key, title, example]) =>
          rxInput(eye + "-" + key, title, example, key === "axis" ? "numeric" : "text")
        ).join("")}</div>
      </fieldset>`).join("")}
    </div>
    <div class="rx-pd">
      <label class="rx-field"><span>Pupillary distance (PD)</span><select id="pd-mode">
        <option value="">Provide later</option>
        <option value="total">One number (total PD)</option>
        <option value="split">Two numbers (right and left PD)</option>
      </select></label>
      <fieldset data-pd="total" hidden disabled><legend class="sr-only">Total pupillary distance</legend>${rxInput("pd", "Total PD (mm)", "63")}</fieldset>
      <fieldset data-pd="split" class="rx-grid" hidden disabled><legend class="sr-only">Right and left pupillary distance</legend>
        ${rxInput("od-pd", "Right PD (mm)", "31.5")}
        ${rxInput("os-pd", "Left PD (mm)", "31.5")}
      </fieldset>
    </div>
    <details class="rx-prism">
      <summary>Prism and base (if prescribed)</summary>
      <div class="rx-eyes">${rxEyes.map(([eye, label]) => `
        <fieldset class="rx-eye"><legend>${label}</legend>
          <div class="rx-grid">${Object.entries(prismDirections).map(([axis, choices]) => `
            ${rxInput(eye + "-" + axis, axis === "horizontal" ? "Horizontal prism (Δ)" : "Vertical prism (Δ)", "1.00")}
            <label class="rx-field"><span>${axis === "horizontal" ? "Horizontal base" : "Vertical base"}</span>
              <select data-rx-input="${eye}-${axis}-base"><option value="">Select base</option>
              ${choices.map(([value, title]) => `<option value="${value}">${title}</option>`).join("")}</select>
            </label>`).join("")}
          </div>
        </fieldset>`).join("")}</div>
    </details>
  </fieldset>`;
}

function updatePdFields(mode) {
  document.querySelectorAll("[data-pd]").forEach(group => {
    group.hidden = group.disabled = group.dataset.pd !== mode;
  });
}

function fillPrescriptionForm(values) {
  const panel = get("#manual-rx");
  if (!panel) return;
  get("#pd-mode").value = values.pdMode || "";
  updatePdFields(values.pdMode);
  panel.querySelectorAll("[data-rx-input]").forEach(input => {
    input.value = values[input.dataset.rxInput] || "";
  });
  get(".rx-prism").open = Object.keys(values).some(key => /-(horizontal|vertical)$/.test(key) && values[key]);
}

function validatePrescription(values, lens) {
  const errors = {};
  const data = { pdMode: values.pdMode || "" };
  function number(key, message, { required = false, integer = false, min = -Infinity, max = Infinity, zeroWords = [] } = {}) {
    const value = (values[key] || "").trim().replaceAll("−", "-").replace(",", ".");
    if (!value && !required) return;
    if (zeroWords.includes(value.toUpperCase())) {
      data[key] = "0";
      return;
    }
    const validFormat = integer ? /^\d+$/ : /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
    const numeric = Number(value);
    if (!validFormat.test(value) || !Number.isFinite(numeric) || numeric < min || numeric > max) {
      errors[key] = message;
    } else {
      data[key] = value;
    }
  }

  for (const [eye] of rxEyes) {
    number(eye + "-sph", "Enter the sphere power, including its sign, or use 0 for plano.", { required: true, zeroWords: ["PL", "PLANO"] });
    number(eye + "-cyl", "Enter the signed cylinder value as written.", { zeroWords: ["DS", "SPH"] });
    const cylinder = Number(data[eye + "-cyl"] || 0);
    number(eye + "-axis", "Enter the cylinder axis as a whole number from 0 to 180.", { required: cylinder !== 0, integer: true, min: 0, max: 180 });
    if (data[eye + "-axis"] && !cylinder && !errors[eye + "-cyl"]) {
      errors[eye + "-cyl"] = "Enter the cylinder value that goes with this axis, or clear the axis.";
    }
    number(eye + "-add", "Enter the near ADD value as written.", { required: lens === "progressive" });

    for (const [axis, choices] of Object.entries(prismDirections)) {
      const key = eye + "-" + axis;
      const base = values[key + "-base"];
      number(key, "Enter the prism amount as a positive number.", { min: Number.MIN_VALUE, required: Boolean(base) });
      if (data[key]) {
        if (choices.some(([value]) => value === base)) data[key + "-base"] = base;
        else errors[key + "-base"] = "Select the base direction for this prism amount.";
      }
    }
  }

  const pdFields = { total: ["pd"], split: ["od-pd", "os-pd"] };
  for (const key of pdFields[data.pdMode] || []) {
    number(key, "Enter the pupillary distance in millimetres.", { required: true, min: Number.MIN_VALUE });
  }
  return { data, errors };
}

function prescriptionReadback(data) {
  const row = (label, value) => `<div><dt>${label}</dt><dd>${value}</dd></div>`;
  const pd = data.pdMode === "total" ? data.pd + " mm" :
    data.pdMode === "split" ? `Right ${data["od-pd"]} mm · Left ${data["os-pd"]} mm` : "Provide later";
  return `<div class="rx-readback">
    <div class="rx-eyes">${rxEyes.map(([eye, label]) => `<div><h2>${label}</h2><dl>
      ${rxFields.map(([key, title]) => row(title, data[eye + "-" + key] ?? "—")).join("")}
      ${Object.keys(prismDirections).map(axis => {
        const key = eye + "-" + axis;
        return data[key] ? row(axis === "horizontal" ? "Horizontal prism" : "Vertical prism", `${data[key]} Δ · Base ${data[key + "-base"]}`) : "";
      }).join("")}
    </dl></div>`).join("")}</div>
    <p><strong>PD</strong> · ${pd}</p>
  </div>`;
}
