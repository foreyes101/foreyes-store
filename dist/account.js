"use strict";

let accountService;
let accountModule;
let accountUser = null;
let accountCart;
let stopWatchingCart;
let accountEpoch = 0;
let accountLoading = Boolean(foreyesFirebaseConfig);
let accountAction = false;
let accountCartReady = false;
let accountWrite = false;
let accountError = "";
let cartError = "";
let confirmedAccountBag = [];

function cartBlocked() {
  return accountLoading || Boolean(accountUser && (!accountCartReady || accountWrite));
}

function accountPage() {
  const title = accountUser ? "My account" : "Your Foreyes account";
  let panel;
  if (!foreyesFirebaseConfig) {
    panel = '<p>Google sign-in will be available once Foreyes connects its Firebase project.</p>';
  } else if (accountUser) {
    panel = `<p id="account-name"></p><p id="account-email" class="hint"></p>
      <a href="#bag" class="button purchase-button">View your bag <span aria-hidden="true">→</span></a>
      <button type="button" class="text-link" data-account="sign-out" ${accountAction || accountWrite ? "disabled" : ""}>Sign out</button>`;
  } else {
    panel = `<p>Sign in to find your saved bag on another device.</p>
      <button type="button" class="button purchase-button" data-account="sign-in" ${accountLoading || accountAction || !accountService ? "disabled" : ""}>Continue with Google</button>`;
  }
  return `${backLink("#shop", "All frames")}<h1 id="page-title" tabindex="-1">${title}</h1>
    <section class="account-panel" aria-label="Account details">${panel}
      <p class="hint" id="account-error" role="status" hidden></p>
      ${accountUser && !accountLoading && !accountCartReady ? '<button type="button" class="text-link" data-account="retry-cart">Retry bag sync</button>' : ""}
    </section>`;
}

function renderAccountDetails() {
  if (get("#account-name")) {
    get("#account-name").textContent = accountUser?.displayName || "Signed in with Google";
    get("#account-email").textContent = accountUser?.email || "";
  }
  const error = get("#account-error");
  if (error) {
    error.textContent = accountError;
    error.hidden = !accountError;
  }
}

function refreshAccountViews() {
  const notice = get("#cart-notice");
  notice.textContent = cartError || (accountLoading ? "Connecting to your saved bag…" : accountWrite ? "Saving your bag…" : "");
  notice.hidden = !notice.textContent;
  updateBagCount();
  if (["#bag", "#checkout", "#account"].includes(location.hash)) renderRoute(false);
  const submit = get('#builder-form[data-step="review"] button[type="submit"]');
  if (submit) submit.disabled = cartBlocked();
}

async function restoreAccountBag(user) {
  const epoch = ++accountEpoch;
  stopWatchingCart?.();
  const previousUser = accountUser;
  accountUser = user;
  accountCartReady = false;
  accountError = "";
  cartError = "";
  accountWrite = false;

  if (previousUser && previousUser.uid !== user?.uid) {
    draft = null;
    draftRx = {};
    bagPrescriptions.clear();
    lastOrder = null;
    saveSession("foreyes-preview-draft", null);
    saveSession("foreyes-preview-order", null);
  }

  if (!user) {
    accountCart = null;
    accountLoading = false;
    bag = guestBag.map(item => ({ ...item }));
    refreshAccountViews();
    return;
  }

  const guestLines = guestBag;
  accountCart = accountService.cartFor(user.uid);
  accountLoading = true;
  bag = [];
  refreshAccountViews();

  try {
    const loaded = await accountCart.load(guestLines);
    if (epoch !== accountEpoch) return;
    confirmedAccountBag = cleanCartLines(loaded);
    bag = confirmedAccountBag.map(item => ({ ...item }));
    saveGuestBag([]);
    accountCartReady = true;
    stopWatchingCart = accountCart.watch(lines => {
      if (epoch !== accountEpoch) return;
      confirmedAccountBag = cleanCartLines(lines);
      if (accountWrite) return;
      bag = confirmedAccountBag.map(item => ({ ...item }));
      refreshAccountViews();
    }, () => {
      if (epoch !== accountEpoch) return;
      accountCartReady = false;
      cartError = "Bag sync stopped. Open Account to retry.";
      refreshAccountViews();
    });
  } catch {
    if (epoch !== accountEpoch) return;
    cartError = "We couldn’t load your saved bag. Open Account to retry.";
  } finally {
    if (epoch === accountEpoch) {
      accountLoading = false;
      refreshAccountViews();
    }
  }
}

async function saveAccountBag() {
  const epoch = accountEpoch;
  const previous = confirmedAccountBag;
  const next = cleanCartLines(bag);
  accountWrite = true;
  cartError = "";
  refreshAccountViews();

  try {
    const saved = await accountCart.save(previous, next);
    if (epoch !== accountEpoch) return false;
    const current = new Map(confirmedAccountBag.map(item => [accountModule.lineId(item), item]));
    for (const [id, item] of saved) {
      if (item) current.set(id, item);
      else current.delete(id);
    }
    confirmedAccountBag = cleanCartLines([...current.values()]);
    return true;
  } catch {
    if (epoch === accountEpoch) cartError = "We couldn’t save that bag change. Please try again.";
    return false;
  } finally {
    if (epoch === accountEpoch) {
      bag = confirmedAccountBag.map(item => ({ ...item }));
      accountWrite = false;
      refreshAccountViews();
    }
  }
}

document.addEventListener("click", async event => {
  const button = event.target.closest("[data-account]");
  if (!button || accountAction || accountWrite || !accountService) return;
  if (button.dataset.account === "retry-cart") {
    await restoreAccountBag(accountUser);
    return;
  }
  accountAction = true;
  accountError = "";
  refreshAccountViews();
  try {
    if (button.dataset.account === "sign-in") await accountService.signIn();
    if (button.dataset.account === "sign-out") await accountService.signOut();
  } catch (error) {
    accountError = error.code === "auth/popup-closed-by-user"
      ? "Sign-in was closed. Try again when you’re ready."
      : "We couldn’t complete that request. Please try again.";
  } finally {
    accountAction = false;
    refreshAccountViews();
    get("[data-account]")?.focus({ preventScroll: true });
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  if (!foreyesFirebaseConfig) return;
  refreshAccountViews();
  try {
    accountModule = await import("./account-firebase.js");
    accountService = accountModule.connectAccounts(foreyesFirebaseConfig);
    accountService.observe(restoreAccountBag, showAuthUnavailable);
  } catch {
    showAuthUnavailable();
  }
});

function showAuthUnavailable() {
  accountError = "Google sign-in is unavailable right now. You can keep shopping as a guest.";
  accountLoading = false;
  refreshAccountViews();
}
