const state = { step: 1, address: "", photos: 0, tier: { name: "Standard Reset", price: 79, duration: 70 }, deadline: "Today by 7:00 PM", bonus: 0 };
const labels = ["Address", "Photos", "Your quote", "Deadline", "Review", "Booked"];
const next = document.querySelector("#next");
const back = document.querySelector("#back");
const screens = ["address", "photos", "quote", "schedule", "confirm", "success"];
const accountButton = document.querySelector("#account-button");
const accountPanel = document.querySelector("#account-panel");
const customerPanel = document.querySelector("#customer-panel");
const adminButton = document.querySelector("#admin-button");
const adminPanel = document.querySelector("#admin-panel");
const supabaseConfig = window.KITCHEN_RESET_CONFIG;
let supabaseClient = null;
let supabaseInitError = null;
if (supabaseConfig && !supabaseConfig.supabaseUrl.includes("YOUR-PROJECT")) {
  try {
    if (!window.supabase?.createClient) throw new Error("The Supabase client did not load.");
    supabaseClient = window.supabase.createClient(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey);
  } catch (error) {
    supabaseInitError = error;
  }
}
let currentUser = null;

function setAuthView(view) {
  document.querySelector("#account-form").classList.toggle("hidden", view !== "email");
  document.querySelector("#password-form").classList.toggle("hidden", view !== "password");
  document.querySelector("#set-password-form").classList.toggle("hidden", view !== "set-password");
  document.querySelector("#password-login-toggle").classList.toggle("hidden", view === "set-password" || view === "password");
}

function showPasswordSetup() {
  accountPanel.classList.remove("hidden");
  setAuthView("set-password");
  document.querySelector("#account-status").textContent = "Your email is verified. Create a password for future sign-ins.";
}

async function locateAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&countrycodes=us&q=${encodeURIComponent(address + ", New York")}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("The address service is unavailable. Please try again.");
  const results = await response.json();
  const result = results[0];
  if (!result) return null;
  const borough = result.address?.borough || result.address?.city_district || "";
  const inPilot = /Brooklyn|Manhattan/i.test(`${borough} ${result.display_name}`);
  return { ...result, borough, inPilot };
}

function showAddressResult(result) {
  const addressResult = document.querySelector("#address-result");
  const mapLink = document.querySelector("#map-link");
  addressResult.classList.remove("hidden");
  document.querySelector("#address-result-copy").textContent = `${result.borough || "NYC"} · verified by OpenStreetMap`;
  mapLink.href = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(result.lat)}&mlon=${encodeURIComponent(result.lon)}#map=18/${encodeURIComponent(result.lat)}/${encodeURIComponent(result.lon)}`;
}

function showStep(step) {
  state.step = step;
  screens.forEach((name, index) => document.querySelector(`#screen-${name}`).classList.toggle("active", index + 1 === step));
  document.querySelector("#step-label").textContent = `${step} · ${labels[step - 1]}`;
  document.querySelector("#step-count").textContent = `${step} of 5`;
  document.querySelector("#progress-fill").style.width = `${Math.min(step, 5) * 20}%`;
  back.classList.toggle("hidden", step === 1 || step === 6);
  document.querySelector(".progress").classList.toggle("hidden", step === 6);
  document.querySelector(".action-bar").classList.toggle("hidden", step === 6);
  const copy = { 1: "Check address", 2: "See my estimate", 3: "Choose a deadline", 4: "Review booking", 5: "Request Kitchen Reset" };
  next.textContent = copy[step] || "";
  next.disabled = step === 2 && state.photos < 3;
}

function updateQuote() {
  document.querySelector("#tier-name").textContent = state.tier.name;
  document.querySelector("#tier-price").textContent = `$${state.tier.price}`;
  document.querySelector("#tier-duration").textContent = `${state.tier.duration} minutes`;
  const signals = [
    { label: "Typical dish load", value: "Standard" },
    { label: "Sink + counter reset", value: "Included" },
    { label: "Cookware handling", value: "Included" }
  ];
  document.querySelector("#quote-signals").innerHTML = signals.map(signal => `<div><span>${signal.label}</span><b>${signal.value}</b></div>`).join("");
}

function updateSummary() {
  const atRisk = document.querySelector("#risk-demo").checked;
  document.querySelector("#risk-alert").classList.toggle("hidden", !atRisk);
  document.querySelector("#confirm-title").textContent = atRisk ? "Your deadline is at risk." : "Almost there.";
  document.querySelector("#summary-tier").textContent = state.tier.name;
  document.querySelector("#summary-deadline").textContent = state.deadline;
  document.querySelector("#summary-price").textContent = `$${state.tier.price}`;
  document.querySelector("#bonus-row").classList.toggle("hidden", state.bonus === 0);
  document.querySelector("#summary-bonus").textContent = `$${state.bonus}`;
  document.querySelector("#summary-total").textContent = `$${state.tier.price + state.bonus}`;
}

document.querySelectorAll(".photo-card input").forEach(input => input.addEventListener("change", event => {
  const card = event.target.closest(".photo-card");
  const file = event.target.files[0];
  if (!card.classList.contains("uploaded") && file) state.photos += 1;
  if (!file) return;
  card.classList.add("uploaded");
  card.querySelector("strong").textContent = "Photo added";
  card.querySelector("small").textContent = "Ready";
  const preview = card.querySelector(".photo-preview");
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    preview.style.backgroundImage = `url("${reader.result}")`;
    preview.classList.add("visible");
  });
  reader.readAsDataURL(file);
  next.disabled = state.photos < 3;
}));

document.querySelectorAll(".slot").forEach(slot => slot.addEventListener("click", () => {
  document.querySelectorAll(".slot").forEach(item => item.classList.remove("selected"));
  slot.classList.add("selected"); state.deadline = slot.dataset.slot;
  document.querySelector("#deadline-copy").innerHTML = `<b>Requested:</b> ${state.deadline}. We’ll notify you early if matching is at risk.`;
}));

document.querySelector("#bonus").addEventListener("input", event => {
  state.bonus = Number(event.target.value);
  document.querySelector("#bonus-value").textContent = `$${state.bonus}`;
  updateSummary();
});

async function saveBooking() {
  if (!supabaseClient || !currentUser) return null;
  const { data: booking, error } = await supabaseClient.from("bookings").insert({
    user_id: currentUser.id,
    address: state.address,
    service_tier: state.tier.name,
    price_cents: state.tier.price * 100,
    bonus_cents: state.bonus * 100,
    duration_minutes: state.tier.duration,
    deadline: state.deadline,
    notes: document.querySelector("#notes").value.trim() || null
  }).select("id").single();
  if (error) throw error;
  for (const input of document.querySelectorAll(".photo-card input")) {
    const file = input.files[0];
    if (!file) continue;
    const path = `${currentUser.id}/${booking.id}/${input.id}-${crypto.randomUUID()}`;
    const upload = await supabaseClient.storage.from("booking-photos").upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) throw upload.error;
    const photo = await supabaseClient.from("booking_photos").insert({
      booking_id: booking.id, user_id: currentUser.id, photo_type: input.id, storage_path: path
    });
    if (photo.error) throw photo.error;
  }
  return booking.id;
}

next.addEventListener("click", async () => {
  if (state.step === 1) {
    state.address = document.querySelector("#address").value.trim();
    const hint = document.querySelector("#address-hint");
    if (!state.address) { hint.textContent = "Please enter an address to check service availability."; hint.classList.add("error"); return; }
    next.disabled = true;
    hint.classList.remove("error");
    hint.textContent = "Checking the address…";
    try {
      const result = await locateAddress(state.address);
      if (!result) throw new Error("We couldn’t locate that address. Check the street, number, and borough.");
      if (!result.inPilot) {
        hint.textContent = "That address is outside the current NYC pilot area. Try a Brooklyn or Manhattan address.";
        hint.classList.add("error");
        document.querySelector("#address-result").classList.add("hidden");
        next.disabled = false;
        return;
      }
      hint.textContent = "Good news—this address is in the pilot service area.";
      showAddressResult(result);
    } catch (error) {
      hint.textContent = error.message;
      hint.classList.add("error");
      document.querySelector("#address-result").classList.add("hidden");
      next.disabled = false;
      return;
    }
    next.disabled = false;
  }
  if (state.step === 2) updateQuote();
  if (state.step === 4) updateSummary();
  if (state.step === 5) {
    next.disabled = true;
    try {
      await saveBooking();
    } catch (error) {
      next.disabled = false;
      document.querySelector("#confirm-title").textContent = "Booking could not be saved.";
      document.querySelector("#confirm-title").insertAdjacentHTML("afterend", `<p class="field-hint error">${error.message}</p>`);
      return;
    }
    document.querySelector("#booking-id").textContent = `KR-${Math.floor(10000 + Math.random() * 89999)}`;
    document.querySelector("#success-deadline").textContent = state.deadline;
    document.querySelector("#success-copy").textContent = `We’ll notify you as soon as your ${state.deadline} deadline is confirmed.`;
  }
  showStep(Math.min(state.step + 1, 6));
});
back.addEventListener("click", () => showStep(Math.max(state.step - 1, 1)));
document.querySelector("#restart").addEventListener("click", () => {
  state.step = 1; state.photos = 0; state.bonus = 0;
  document.querySelectorAll(".photo-card").forEach(card => {
    const input = card.querySelector("input");
    card.classList.remove("uploaded");
    input.value = "";
    card.querySelector("strong").textContent = input.id === "sink-photo" ? "Full sink" : input.id === "counter-photo" ? "Counter & drying area" : input.id === "cookware-photo" ? "Cookware" : "Wide view";
    card.querySelector("small").textContent = input.id === "wide-photo" ? "Optional" : "Required";
    card.querySelector(".photo-preview").style.backgroundImage = "";
    card.querySelector(".photo-preview").classList.remove("visible");
  });
  document.querySelector("#address-result").classList.add("hidden");
  showStep(1);
});

function updateAccountButton() {
  const email = currentUser?.email || localStorage.getItem("kitchenResetEmail");
  accountButton.textContent = currentUser ? "Account" : (email ? email.split("@")[0] : "Sign in");
  accountButton.classList.toggle("signed-in", Boolean(email));
  document.querySelector("#sign-out").classList.toggle("hidden", !email);
  document.querySelector("#password-login-toggle").classList.toggle("hidden", Boolean(currentUser));
}

accountButton.addEventListener("click", () => {
  if (currentUser) {
    customerPanel.classList.toggle("hidden");
    if (!customerPanel.classList.contains("hidden")) loadCustomerBookings();
    return;
  }
  accountPanel.classList.remove("hidden");
  setAuthView("email");
  document.querySelector("#account-email").focus();
});
document.querySelector("#close-account").addEventListener("click", () => accountPanel.classList.add("hidden"));
document.querySelector("#close-customer").addEventListener("click", () => customerPanel.classList.add("hidden"));
async function signOut() {
  if (supabaseClient) {
    const { error } = await supabaseClient.auth.signOut();
    if (error) {
      document.querySelector("#account-status").textContent = error.message;
      return;
    }
  }
  currentUser = null;
  localStorage.removeItem("kitchenResetEmail");
  document.querySelector("#account-status").textContent = "You have been signed out.";
  customerPanel.classList.add("hidden");
  setAuthView("email");
  updateAccountButton();
}
document.querySelector("#sign-out").addEventListener("click", signOut);
document.querySelector("#customer-sign-out").addEventListener("click", signOut);
document.querySelector("#account-form").addEventListener("submit", event => {
  event.preventDefault();
  const email = document.querySelector("#account-email").value.trim();
  if (!supabaseClient) {
    localStorage.setItem("kitchenResetEmail", email);
    document.querySelector("#account-status").textContent = supabaseInitError
      ? `Sign-in is temporarily unavailable: ${supabaseInitError.message}`
      : "Saved locally. Add Supabase config to enable account sync.";
    updateAccountButton();
    return;
  }
  supabaseClient.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
    .then(({ error }) => {
      if (error) throw error;
      document.querySelector("#account-status").textContent = "Check your email for a secure sign-in link.";
    })
    .catch(error => { document.querySelector("#account-status").textContent = error.message; });
});
document.querySelector("#password-login-toggle").addEventListener("click", () => {
  setAuthView("password");
  document.querySelector("#account-password").focus();
});
document.querySelector("#password-form").addEventListener("submit", async event => {
  event.preventDefault();
  const status = document.querySelector("#account-status");
  status.textContent = "Signing in…";
  const { error } = await supabaseClient.auth.signInWithPassword({
    email: document.querySelector("#account-email").value.trim(),
    password: document.querySelector("#account-password").value
  });
  status.textContent = error ? error.message : "Signed in.";
});
document.querySelector("#set-password-form").addEventListener("submit", async event => {
  event.preventDefault();
  const password = document.querySelector("#new-password").value;
  const confirmation = document.querySelector("#confirm-password").value;
  const status = document.querySelector("#account-status");
  if (password.length < 8 || password !== confirmation) {
    status.textContent = "Use at least 8 characters and make both passwords match.";
    status.classList.add("error");
    return;
  }
  const { error } = await supabaseClient.auth.updateUser({ password, data: { password_set: true } });
  if (error) {
    status.textContent = error.message;
    status.classList.add("error");
    return;
  }
  status.classList.remove("error");
  status.textContent = "Password saved. You can now use it for future sign-ins.";
  setAuthView("email");
});

if (supabaseClient) {
  supabaseClient.auth.getUser().then(({ data }) => {
    currentUser = data.user;
    if (currentUser) {
      localStorage.setItem("kitchenResetEmail", currentUser.email);
      updateAccountButton();
      if (!currentUser.user_metadata?.password_set) showPasswordSetup();
    }
    updateAdminAccess();
  });
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    if (currentUser) {
      localStorage.setItem("kitchenResetEmail", currentUser.email);
      updateAccountButton();
      if (_event === "SIGNED_IN" && !currentUser.user_metadata?.password_set) showPasswordSetup();
    } else {
      customerPanel.classList.add("hidden");
      setAuthView("email");
    }
    updateAdminAccess();
  });
}

async function updateAdminAccess() {
  if (!supabaseClient || !currentUser) {
    adminButton.classList.add("hidden");
    adminPanel.classList.add("hidden");
    return;
  }
  const { data, error } = await supabaseClient.from("admin_users").select("user_id").eq("user_id", currentUser.id).maybeSingle();
  if (error || !data) {
    adminButton.classList.add("hidden");
    return;
  }
  adminButton.classList.remove("hidden");
}

async function loadAdminBookings() {
  const status = document.querySelector("#admin-status");
  const list = document.querySelector("#admin-bookings");
  status.textContent = "Loading bookings…";
  const { data, error } = await supabaseClient.from("bookings").select("id,address,service_tier,price_cents,deadline,status,created_at").order("created_at", { ascending: false }).limit(50);
  if (error) {
    status.textContent = error.message;
    return;
  }
  status.textContent = `${data.length} booking${data.length === 1 ? "" : "s"}`;
  list.innerHTML = data.length
    ? data.map(booking => `<div class="admin-booking"><strong>${booking.service_tier} · $${(booking.price_cents / 100).toFixed(0)}</strong><small>${booking.address}<br>${booking.deadline} · ${booking.status}</small></div>`).join("")
    : "<p class=\"field-hint\">No bookings yet.</p>";
}

async function loadCustomerBookings() {
  const status = document.querySelector("#customer-status");
  const list = document.querySelector("#customer-bookings");
  status.textContent = "Loading your bookings…";
  const { data, error } = await supabaseClient.from("bookings").select("id,address,service_tier,price_cents,bonus_cents,deadline,status,created_at").order("created_at", { ascending: false }).limit(20);
  if (error) {
    status.textContent = error.message;
    return;
  }
  status.textContent = `${data.length} booking${data.length === 1 ? "" : "s"}`;
  list.innerHTML = data.length
    ? data.map(booking => `<article class="booking-card"><strong>${booking.service_tier} · $${((booking.price_cents + booking.bonus_cents) / 100).toFixed(0)}</strong><small>${booking.address}<br>${booking.deadline}</small><span class="booking-status">${booking.status}</span></article>`).join("")
    : "<p class=\"field-hint\">You have no bookings yet.</p>";
}

adminButton.addEventListener("click", () => {
  adminPanel.classList.toggle("hidden");
  if (!adminPanel.classList.contains("hidden")) loadAdminBookings();
});
document.querySelector("#close-admin").addEventListener("click", () => adminPanel.classList.add("hidden"));

updateAccountButton();
showStep(1);
