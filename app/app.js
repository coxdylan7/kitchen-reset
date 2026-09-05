const state = { step: 1, address: "", photos: 0, addressVerified: false, tier: { name: "Standard Reset", price: 79, duration: 70 }, deadline: "Today by 7:00 PM", bonus: 0 };
const labels = ["Address", "Photos", "Your quote", "Deadline", "Review", "Booked"];
const next = document.querySelector("#next");
const back = document.querySelector("#back");
const screens = ["address", "photos", "quote", "schedule", "confirm", "success"];
const accountButton = document.querySelector("#account-button");
const accountPanel = document.querySelector("#account-panel");
const proButton = document.querySelector("#pro-button");
const proPanel = document.querySelector("#pro-panel");
const mapPanel = document.querySelector("#map-panel");
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
let mapSearchAddress = "";
let addressSearchTimer = null;
let approvedRegions = [];

function openPage(panel) {
  [accountPanel, adminPanel, proPanel, mapPanel]
    .filter(Boolean)
    .forEach(item => item.classList.add("hidden"));
  document.querySelectorAll(".screen").forEach(screen => screen.classList.remove("active"));
  document.querySelector(".progress").classList.add("hidden");
  document.querySelector(".action-bar").classList.add("hidden");
  panel.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function closePage(panel) {
  panel.classList.add("hidden");
  document.querySelector(".progress").classList.remove("hidden");
  if (state.step !== 6) document.querySelector(".action-bar").classList.remove("hidden");
  showStep(state.step);
}

function setAuthView(view) {
  document.querySelector("#account-form").classList.toggle("hidden", view !== "email");
  document.querySelector("#set-password-form").classList.toggle("hidden", view !== "set-password");
  document.querySelector("#create-account-button").classList.toggle("hidden", view !== "email");
  document.querySelector("#magic-link-button").classList.toggle("hidden", view !== "email");
}

function showPasswordSetup() {
  accountPanel.classList.remove("hidden");
  setAuthView("set-password");
  document.querySelector("#account-status").textContent = "Your email is verified. Create a password for future sign-ins.";
}

async function locateAddress(address) {
  const selectedRegion = document.querySelector("#service-region").selectedOptions[0]?.textContent || "";
  const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&maxLocations=1&outFields=*&singleLine=${encodeURIComponent(`${address}, ${selectedRegion}`)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("The address service is unavailable. Use the map link to verify it.");
  const payload = await response.json();
  const candidate = payload.candidates?.[0];
  const result = candidate ? {
    display_name: candidate.address,
    lat: candidate.location.y,
    lon: candidate.location.x,
    address: {
      city: candidate.attributes?.City || "",
      state: candidate.attributes?.RegionAbbr || candidate.attributes?.Region || "",
      zip: candidate.attributes?.Postal || "",
      neighborhood: candidate.attributes?.Nbrhd || "",
      district: candidate.attributes?.District || "",
      county: candidate.attributes?.Subregion || ""
    }
  } : null;
  if (!result) return null;
  const borough = result.address?.city || "";
  const { data: pilotRegions, error: regionError } = supabaseClient
    ? await supabaseClient.from("pilot_regions").select("name,borough,state").eq("active", true)
    : { data: [], error: new Error("Approved service regions are unavailable.") };
  if (regionError) throw new Error("Approved service regions are unavailable right now.");
  const activeRegions = pilotRegions || [];
  const selectedRegionName = document.querySelector("#service-region").value;
  const selectedOption = document.querySelector("#service-region").selectedOptions[0];
  const matchedRegion = activeRegions.find(region => region.name === selectedRegionName);
  const regionText = `${result.display_name} ${result.address.city} ${result.address.neighborhood || ""} ${result.address.district || ""} ${result.address.county || ""}`.toLowerCase();
  const boroughMatches = matchedRegion && (
    regionText.includes(matchedRegion.name.toLowerCase()) ||
    regionText.includes(matchedRegion.borough.toLowerCase())
  );
  const enteredState = document.querySelector("#address-state").value;
  const enteredCity = document.querySelector("#address-city").value.trim().toLowerCase();
  const inPilot = Boolean(matchedRegion && enteredState === result.address.state && enteredCity === result.address.city.toLowerCase() && boroughMatches);
  return { ...result, borough, inPilot, matchedRegion };
}

async function suggestAddresses(value) {
  const region = document.querySelector("#service-region").selectedOptions[0]?.textContent;
  if (value.trim().length < 3 || !region) return;
  const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?f=json&maxSuggestions=5&text=${encodeURIComponent(`${value}, ${region}`)}`;
  const response = await fetch(url);
  if (!response.ok) return;
  const results = await response.json();
  const datalist = document.querySelector("#address-suggestions");
  datalist.innerHTML = (results.suggestions || []).map(result => `<option value="${result.text}"></option>`).join("");
}

async function extrapolateAddress() {
  const input = document.querySelector("#address-street");
  if (input.value.trim().length < 5 || !document.querySelector("#service-region").value) return;
  try {
    const result = await locateAddress(input.value.trim());
    if (!result) return;
    document.querySelector("#address-city").value = result.address.city;
    document.querySelector("#address-state").value = result.address.state;
    document.querySelector("#address-zip").value = result.address.zip;
    document.querySelector("#address-hint").textContent = "Address details filled from the selected approved-region search.";
  } catch (error) {
    document.querySelector("#address-hint").textContent = error.message;
    document.querySelector("#address-hint").classList.add("error");
  }
}

document.querySelector("#address-street").addEventListener("input", event => {
  state.addressVerified = false;
  document.querySelector("#address-result").classList.add("hidden");
  clearTimeout(addressSearchTimer);
  addressSearchTimer = setTimeout(() => suggestAddresses(event.target.value).catch(() => {}), 350);
});
document.querySelector("#address-street").addEventListener("change", extrapolateAddress);
document.querySelector("#address-street").addEventListener("blur", extrapolateAddress);

function showAddressResult(result) {
  const addressResult = document.querySelector("#address-result");
  const mapLink = document.querySelector("#map-link");
  addressResult.classList.remove("hidden");
  document.querySelector("#address-result-copy").textContent = `${result.display_name} · address located`;
  mapLink.href = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(result.lat)}&mlon=${encodeURIComponent(result.lon)}#map=18/${encodeURIComponent(result.lat)}/${encodeURIComponent(result.lon)}`;
  document.querySelector("#google-map-link").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${result.lat},${result.lon}`)}`;
  mapSearchAddress = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(result.lat)}&mlon=${encodeURIComponent(result.lon)}#map=18/${encodeURIComponent(result.lat)}/${encodeURIComponent(result.lon)}`;
  document.querySelector("#map-title").textContent = result.display_name;
  document.querySelector("#map-copy").textContent = "Verified by OpenStreetMap.";
  document.querySelector("#map-page-link").href = mapSearchAddress;
  document.querySelector("#google-map-page-link").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${result.lat},${result.lon}`)}`;
  setMapPreviews(result.lat, result.lon);
}

function setMapPreviews(lat, lon) {
  const bbox = `${Number(lon) - 0.01},${Number(lat) - 0.01},${Number(lon) + 0.01},${Number(lat) + 0.01}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${lat},${lon}`)}`;
  ["#map-page-preview", "#map-inline-preview"].forEach(selector => {
    const frame = document.querySelector(selector);
    if (!frame) return;
    frame.onload = () => {
      const status = selector === "#map-inline-preview" ? document.querySelector("#map-inline-status") : null;
      if (status) status.textContent = "Map preview loaded from OpenStreetMap.";
    };
    frame.onerror = () => {
      const status = selector === "#map-inline-preview" ? document.querySelector("#map-inline-status") : null;
      if (status) status.textContent = "The embedded map could not load. Use Open in OpenStreetMap above.";
    };
    frame.src = embedUrl;
  });
}

function showMapSearch(address) {
  const addressResult = document.querySelector("#address-result");
  const region = document.querySelector("#service-region").selectedOptions[0]?.textContent || "New York, New Jersey, Connecticut";
  addressResult.classList.remove("hidden");
  document.querySelector("#address-result-copy").textContent = "OpenStreetMap search";
  document.querySelector("#map-link").href = `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${address}, ${region}`)}`;
  mapSearchAddress = `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${address}, ${region}`)}`;
  document.querySelector("#map-title").textContent = address;
  document.querySelector("#map-copy").textContent = `OpenStreetMap search preview for ${region}.`;
  document.querySelector("#map-page-link").href = mapSearchAddress;
  document.querySelector("#google-map-page-link").href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${region}`)}`;
  document.querySelector("#map-inline-preview").removeAttribute("src");
  document.querySelector("#map-page-preview").removeAttribute("src");
  document.querySelector("#map-inline-status").textContent = "Exact map preview will appear after the address is located.";
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
    const street = document.querySelector("#address-street").value.trim();
    const unit = document.querySelector("#address-unit").value.trim();
    const city = document.querySelector("#address-city").value.trim();
    const addressState = document.querySelector("#address-state").value;
    const zip = document.querySelector("#address-zip").value.trim();
    state.address = [street, unit, city, addressState, zip].filter(Boolean).join(", ");
    const hint = document.querySelector("#address-hint");
    if (state.addressVerified) {
      showStep(2);
      return;
    }
    if (!street || !city || !addressState || !zip) { hint.textContent = "Enter the street, city, state, and ZIP code."; hint.classList.add("error"); return; }
    if (!document.querySelector("#service-region").value) {
      hint.textContent = "Choose a service region before checking the address.";
      hint.classList.add("error");
      return;
    }
    next.disabled = true;
    hint.classList.remove("error");
    hint.textContent = "Checking the address…";
    showMapSearch(state.address);
    try {
      const result = await locateAddress(state.address);
      if (!result) throw new Error("We couldn’t locate that address. Check the street, number, and borough.");
      if (!result.inPilot) {
        hint.textContent = "That address is outside the selected service region. Check the address or choose another region.";
        hint.classList.add("error");
        showMapSearch(state.address);
        next.disabled = false;
        return;
      }
      hint.textContent = "Good news—this address is in the pilot service area.";
      showAddressResult(result);
    } catch (error) {
      hint.textContent = error.message;
      hint.classList.add("error");
      showMapSearch(state.address);
      next.disabled = false;
      return;
    }
    next.disabled = false;
    state.addressVerified = true;
    next.textContent = "Continue to photos";
    return;
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
  state.step = 1; state.photos = 0; state.addressVerified = false; state.bonus = 0;
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
  accountButton.textContent = currentUser ? "Account" : "Sign in";
  accountButton.classList.toggle("signed-in", Boolean(email));
  document.querySelector("#create-account-button").classList.toggle("hidden", Boolean(currentUser));
  document.querySelector("#magic-link-button").classList.toggle("hidden", Boolean(currentUser));
  if (currentUser) {
    document.querySelector("#account-dashboard-content").classList.remove("hidden");
    document.querySelector("#account-email-display").textContent = currentUser.email;
    document.querySelector("#account-address").value = localStorage.getItem("kitchenResetAddress") || "";
    setAuthView("email");
    document.querySelector("#account-form").classList.add("hidden");
    document.querySelector("#set-password-form").classList.add("hidden");
    document.querySelector("#create-account-button").classList.add("hidden");
    document.querySelector("#magic-link-button").classList.add("hidden");
    document.querySelector("#account-status").classList.add("hidden");
  } else {
    document.querySelector("#account-dashboard-content").classList.add("hidden");
    document.querySelector("#account-form").classList.remove("hidden");
    document.querySelector("#account-status").classList.remove("hidden");
  }
}

accountButton.addEventListener("click", () => {
  if (currentUser) {
    openPage(accountPanel);
    loadAccountBookings();
    return;
  }
  openPage(accountPanel);
  setAuthView("email");
  document.querySelector("#account-email").focus();
});
document.querySelector("#close-map").addEventListener("click", () => closePage(mapPanel));
document.querySelector("#close-account").addEventListener("click", () => closePage(accountPanel));
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
  accountPanel.classList.add("hidden");
  document.querySelector(".progress").classList.remove("hidden");
  document.querySelector(".action-bar").classList.remove("hidden");
  showStep(state.step);
  setAuthView("email");
  updateAccountButton();
}
document.querySelector("#account-dashboard-sign-out").addEventListener("click", signOut);
document.querySelector("#save-account-address").addEventListener("click", () => {
  const address = document.querySelector("#account-address").value.trim();
  const region = document.querySelector("#account-region").value;
  const status = document.querySelector("#account-address-status");
  if (!address || !region) {
    status.textContent = "Enter an address and choose a service region.";
    status.classList.add("error");
    return;
  }
  localStorage.setItem("kitchenResetAddress", address);
  localStorage.setItem("kitchenResetRegion", region);
  document.querySelector("#address-street").value = address;
  document.querySelector("#service-region").value = region;
  status.textContent = "Address saved. It will be used for your next booking.";
  status.classList.remove("error");
});
document.querySelector("#account-form").addEventListener("submit", event => {
  event.preventDefault();
  const email = document.querySelector("#account-email").value.trim();
  const password = document.querySelector("#account-password").value;
  if (!supabaseClient) {
    localStorage.setItem("kitchenResetEmail", email);
    document.querySelector("#account-status").textContent = supabaseInitError
      ? `Sign-in is temporarily unavailable: ${supabaseInitError.message}`
      : "Saved locally. Add Supabase config to enable account sync.";
    updateAccountButton();
    return;
  }
  supabaseClient.auth.signInWithPassword({ email, password })
    .then(async ({ error }) => {
      if (!error) {
        document.querySelector("#account-status").textContent = "Signed in.";
        return;
      }
      document.querySelector("#account-status").textContent = `${error.message} New customers can use Create an account.`;
    })
    .catch(error => { document.querySelector("#account-status").textContent = error.message; });
});
document.querySelector("#create-account-button").addEventListener("click", async () => {
  const email = document.querySelector("#account-email").value.trim();
  const password = document.querySelector("#account-password").value;
  if (!email || password.length < 8) {
    document.querySelector("#account-status").textContent = "Enter an email and a password with at least 8 characters.";
    return;
  }
  const { error } = await supabaseClient.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
  document.querySelector("#account-status").textContent = error ? error.message : "Check your email to verify your new account.";
});
document.querySelector("#magic-link-button").addEventListener("click", async () => {
  const email = document.querySelector("#account-email").value.trim();
  if (!email) {
    document.querySelector("#account-status").textContent = "Enter your email first.";
    return;
  }
  const { error } = await supabaseClient.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } });
  document.querySelector("#account-status").textContent = error ? error.message : "Check your email for the sign-in link.";
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
      accountPanel.classList.add("hidden");
      if (_event === "SIGNED_IN" && !currentUser.user_metadata?.password_set) showPasswordSetup();
    } else {
      accountPanel.classList.add("hidden");
      setAuthView("email");
    }
    updateAdminAccess();
  });
}

proButton.addEventListener("click", () => openPage(proPanel));
document.querySelector("#close-pro").addEventListener("click", () => closePage(proPanel));
document.querySelector("#pro-form").addEventListener("submit", async event => {
  event.preventDefault();
  const status = document.querySelector("#pro-status");
  if (!supabaseClient) {
    status.textContent = "Connect Supabase before submitting an application.";
    return;
  }
  const { error } = await supabaseClient.from("professional_applications").insert({
    name: document.querySelector("#pro-name").value.trim(),
    email: document.querySelector("#pro-email").value.trim(),
    neighborhood: document.querySelector("#pro-region").value,
    region: document.querySelector("#pro-region").value,
    experience: document.querySelector("#pro-experience").value.trim()
  });
  status.textContent = error ? error.message : "Application received. We’ll be in touch after review.";
  if (!error) event.target.reset();
});

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
  const bookings = data || [];
  if (error) status.textContent = `Bookings unavailable: ${error.message}`;
  if (!error) status.textContent = `${bookings.length} booking${bookings.length === 1 ? "" : "s"}`;
  list.innerHTML = bookings.length
    ? bookings.map(booking => `<div class="admin-booking"><strong>${booking.service_tier} · $${(booking.price_cents / 100).toFixed(0)}</strong><small>${booking.address}<br>${booking.deadline} · ${booking.status}</small></div>`).join("")
    : "<p class=\"field-hint\">No bookings yet.</p>";
  loadPilotAddresses();
}

async function loadPilotAddresses() {
  const list = document.querySelector("#pilot-regions");
  const suggestions = document.querySelector("#region-suggestions");
  const regionStatus = document.querySelector("#region-status");
  let { data, error } = await supabaseClient.from("pilot_regions").select("id,name,borough,state,active").order("name");
  if (error && /state/i.test(error.message)) {
    const fallback = await supabaseClient.from("pilot_regions").select("id,name,borough,active").order("name");
    data = fallback.data?.map(item => ({ ...item, state: "NY" }));
    error = fallback.error;
  }
  if (error) {
    regionStatus.textContent = "Unable to load";
    list.innerHTML = `<p class="field-hint error">${error.message}</p>`;
    return;
  }
  regionStatus.textContent = `${data.length} configured · ${data.filter(item => item.active).length} active`;
  document.querySelector("#active-region-count").textContent = data.filter(item => item.active).length;
  document.querySelector("#total-region-count").textContent = data.length;

  list.innerHTML = data.length
    ? data.map(item => `<div class="admin-booking"><strong>${item.name}</strong><small>${item.borough}, ${item.state} · ${item.active ? "Active" : "Inactive"} <button class="text-button address-toggle" data-id="${item.id}" data-active="${item.active}">${item.active ? "Disable" : "Enable"}</button> <button class="text-button address-delete" data-id="${item.id}">Delete permanently</button></small></div>`).join("")
    : "<p class=\"field-hint\">No pilot regions configured.</p>";
  const existing = new Set([...suggestions.options].map(option => option.value.toLowerCase()));
  data.forEach(item => {
    if (existing.has(item.name.toLowerCase())) return;
    const option = document.createElement("option");
    option.value = item.name;
    option.label = `${item.name} · ${item.borough}`;
    suggestions.appendChild(option);
  });
  list.querySelectorAll(".address-toggle").forEach(button => button.addEventListener("click", async () => {
    const { error: updateError } = await supabaseClient.from("pilot_regions").update({ active: button.dataset.active !== "true" }).eq("id", button.dataset.id);
    if (updateError) list.insertAdjacentHTML("afterbegin", `<p class="field-hint error">${updateError.message}</p>`);
    else loadPilotAddresses();
  }));
  list.querySelectorAll(".address-delete").forEach(button => button.addEventListener("click", async () => {
    const { error: deleteError } = await supabaseClient.from("pilot_regions").delete().eq("id", button.dataset.id);
    if (deleteError) list.insertAdjacentHTML("afterbegin", `<p class="field-hint error">${deleteError.message}</p>`);
    else loadPilotAddresses();
  }));
}

async function loadDirectory() {
  const list = document.querySelector("#directory-regions");
  if (!supabaseClient) {
    list.innerHTML = "<p class=\"field-hint\">Connect the service directory to view active regions.</p>";
    return;
  }
  const { data, error } = await supabaseClient.from("pilot_regions").select("name,borough,description,map_url").eq("active", true).order("name");
  if (error) {
    list.innerHTML = `<p class="field-hint error">${error.message}</p>`;
    return;
  }
  list.innerHTML = data.length
    ? data.map(region => `<article class="directory-card"><strong>${region.name}</strong><small>${region.borough}${region.description ? ` · ${region.description}` : ""}</small><a href="${region.map_url || `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${region.name}, ${region.borough}, New York`)}`}" target="_blank" rel="noopener">Open region in OpenStreetMap</a></article>`).join("")
    : "<p class=\"field-hint\">No active regions have been published yet.</p>";
}

document.querySelector("#map-view-button").addEventListener("click", () => {
  if (mapSearchAddress) openPage(mapPanel);
});

document.querySelector("#region-form").addEventListener("submit", async event => {
  event.preventDefault();
  const { error } = await supabaseClient.from("pilot_regions").insert({
    name: document.querySelector("#pilot-region").value.trim(),
    borough: document.querySelector("#pilot-borough").value.trim(),
    state: document.querySelector("#pilot-state").value,
    description: document.querySelector("#pilot-description").value.trim() || null,
    map_url: document.querySelector("#pilot-map-url").value.trim() || null
  });
  if (error) {
    document.querySelector("#admin-status").textContent = error.message;
    return;
  }
  event.target.reset();
  loadPilotAddresses();
});

async function loadProfessionalRegions() {
  const select = document.querySelector("#pro-region");
  const addressRegion = document.querySelector("#service-region");
  const accountRegion = document.querySelector("#account-region");
  const { data } = supabaseClient
    ? await supabaseClient.from("pilot_regions").select("name,borough,state").eq("active", true).order("name")
    : { data: null };
  approvedRegions = data || [];
  const options = approvedRegions.map(region => `<option value="${region.name}" data-state="${region.state}">${region.name} · ${region.borough}, ${region.state}</option>`).join("");
  select.innerHTML = '<option value="">Choose an approved region</option>' + options;
  addressRegion.innerHTML = approvedRegions.length
    ? '<option value="">Choose an approved service region first</option>' + options
    : '<option value="">No approved service regions are available</option>';
  accountRegion.innerHTML = '<option value="">Choose a region</option>' + options;
  const savedRegion = localStorage.getItem("kitchenResetRegion");
  if (savedRegion) {
    addressRegion.value = savedRegion;
    accountRegion.value = savedRegion;
  }
  const savedAddress = localStorage.getItem("kitchenResetAddress");
  if (savedAddress) document.querySelector("#address-street").value = savedAddress;
}
loadProfessionalRegions();

async function loadAccountBookings() {
  const status = document.querySelector("#account-customer-status");
  const list = document.querySelector("#account-customer-bookings");
  if (!supabaseClient || !currentUser) return;
  const { data, error } = await supabaseClient.from("bookings").select("service_tier,address,price_cents,bonus_cents,deadline,status").order("created_at", { ascending: false }).limit(20);
  if (error) {
    status.textContent = error.message;
    return;
  }
  status.textContent = `${data.length} booking${data.length === 1 ? "" : "s"}`;
  list.innerHTML = data.length ? data.map(booking => `<article class="booking-card"><strong>${booking.service_tier} · $${((booking.price_cents + booking.bonus_cents) / 100).toFixed(0)}</strong><small>${booking.address}<br>${booking.deadline}</small><span class="booking-status">${booking.status}</span></article>`).join("") : "<p class=\"field-hint\">You have no bookings yet.</p>";
}


adminButton.addEventListener("click", () => {
  openPage(adminPanel);
  loadAdminBookings();
});
document.querySelector("#close-admin").addEventListener("click", () => closePage(adminPanel));

updateAccountButton();
showStep(1);
