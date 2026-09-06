const state = { step: 1, address: "", photos: 0, addressVerified: false, bookingId: null, tier: { name: "Standard Reset", price: 79, duration: 70 }, deadline: "Today by 7:00 PM", bonus: 0 };
const labels = ["Address", "Photos", "Your quote", "Deadline", "Review", "Booked"];
const next = document.querySelector("#next");
const back = document.querySelector("#back");
const screens = ["address", "photos", "quote", "schedule", "confirm", "success"];
const accountButton = document.querySelector("#account-button");
const accountPanel = document.querySelector("#account-panel");
const proPanel = document.querySelector("#pro-panel");
const workerButton = document.querySelector("#worker-button");
const workerPanel = document.querySelector("#worker-panel");
const mapPanel = document.querySelector("#map-panel");
const adminButton = document.querySelector("#admin-button");
const adminPanel = document.querySelector("#admin-panel");
const headerBookButton = document.querySelector("#header-book-button");
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
let verifiedAccountAddress = "";
let selectedAdminRegion = null;
const workerJobs = new Map();
const workerStatusOverrides = new Map();

function distanceMiles(lat1, lon1, lat2, lon2) {
  const radians = value => value * Math.PI / 180;
  const earthRadius = 3958.8;
  const deltaLat = radians(lat2 - lat1);
  const deltaLon = radians(lon2 - lon1);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findRegionMatch(lat, lon, state, regions) {
  const normalizedState = String(state || "").toUpperCase();
  return (regions || [])
    .filter(region => region.latitude != null && region.longitude != null && String(region.state || "").toUpperCase() === normalizedState)
    .map(region => ({ region, distance: distanceMiles(lat, lon, region.latitude, region.longitude) }))
    .filter(match => match.distance <= Number(match.region.radius_miles))
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

function openPage(panel) {
  [accountPanel, adminPanel, proPanel, workerPanel, mapPanel]
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
  const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&maxLocations=1&outFields=*&singleLine=${encodeURIComponent(`${address}, USA`)}`;
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
    ? await supabaseClient.from("pilot_regions").select("name,borough,state,latitude,longitude,radius_miles").eq("active", true)
    : { data: [], error: new Error("Approved service regions are unavailable.") };
  if (regionError) throw new Error("Approved service regions are unavailable right now.");
  const activeRegions = pilotRegions || [];
  const closestMatch = findRegionMatch(result.lat, result.lon, result.address.state, activeRegions);
  const inPilot = Boolean(closestMatch);
  return { ...result, borough, inPilot, matchedRegion: closestMatch?.region || null, regionDistance: closestMatch?.distance || null };
}

async function suggestAddresses(value) {
  if (value.trim().length < 3) return;
  const url = `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?f=json&maxSuggestions=5&text=${encodeURIComponent(`${value}, USA`)}`;
  const response = await fetch(url);
  if (!response.ok) return;
  const results = await response.json();
  const datalist = document.querySelector("#address-suggestions");
  datalist.innerHTML = (results.suggestions || []).map(result => `<option value="${result.text}"></option>`).join("");
}

async function lookupAddressCandidate(address) {
  const response = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&maxLocations=1&outFields=*&singleLine=${encodeURIComponent(`${address}, USA`)}`);
  if (!response.ok) throw new Error("The address service is unavailable right now.");
  const payload = await response.json();
  const candidate = payload.candidates?.[0];
  if (!candidate) throw new Error("Address not found. Check the street, city, state, and ZIP.");
  return candidate;
}

async function lookupRegionCandidate(searchText) {
  const response = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?f=json&maxLocations=5&outFields=*&singleLine=${encodeURIComponent(`${searchText}, USA`)}`);
  if (!response.ok) throw new Error("The map service is unavailable right now.");
  const payload = await response.json();
  const candidates = payload.candidates || [];
  const countySearch = /\bcounty\b/i.test(searchText);
  const requestedCounty = countySearch
    ? searchText.replace(/\s*,?\s*(NY|NJ|CT|New York|New Jersey|Connecticut)\b.*$/i, "").trim().toLowerCase()
    : "";
  const matchingCounty = candidates.find(item => {
    const attrs = item.attributes || {};
    const resultCounty = String(attrs.Subregion || attrs.PlaceName || "").trim().toLowerCase();
    return String(attrs.Type || "").toLowerCase() === "county" &&
      resultCounty === requestedCounty;
  });
  if (countySearch && !matchingCounty) {
    throw new Error(`The map service did not return an exact match for “${searchText}”. Search for the full county name, such as “Suffolk County, NY”.`);
  }
  const candidate = matchingCounty ||
    candidates.find(item => !countySearch || !["state", "region"].includes(String(item.attributes?.Type || item.attributes?.Addr_type || "").toLowerCase())) ||
    candidates[0];
  if (!candidate) throw new Error("Region not found. Search for a specific county, city, or neighborhood.");
  return candidate;
}

async function extrapolateAddress() {
  const input = document.querySelector("#address-street");
  if (input.value.trim().length < 5) return;
  try {
    const candidate = await lookupAddressCandidate(input.value.trim());
    document.querySelector("#address-city").value = candidate.attributes?.City || "";
    document.querySelector("#address-state").value = candidate.attributes?.RegionAbbr || "";
    document.querySelector("#address-zip").value = candidate.attributes?.Postal || "";
    document.querySelector("#address-hint").textContent = "Address details filled from the address lookup.";
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

function showAddressResult(result) {
  const addressResult = document.querySelector("#address-result");
  const mapLink = document.querySelector("#map-link");
  addressResult.classList.remove("hidden");
  const availability = document.querySelector("#address-availability");
  const title = document.querySelector("#address-result-title");
  title.textContent = result.inPilot ? "Address available" : "Address not available";
  availability.textContent = result.inPilot
    ? `Cross-referenced with active region: ${result.matchedRegion.name} · ${result.regionDistance.toFixed(2)} miles from center`
    : "Verified, but outside the distance limits of every active Admin-approved region.";
  availability.className = result.inPilot ? "availability" : "unavailable";
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
  const region = "United States";
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

function startBooking() {
  [accountPanel, adminPanel, proPanel, workerPanel, mapPanel]
    .filter(Boolean)
    .forEach(item => item.classList.add("hidden"));
  document.querySelector(".progress").classList.remove("hidden");
  document.querySelector(".action-bar").classList.remove("hidden");
  state.step = 1;
  showStep(1);
  document.querySelector("#address-street").focus();
}

function openBookingEntry() {
  if (currentUser) {
    startBooking();
    return;
  }
  openPage(accountPanel);
  setAuthView("email");
  document.querySelector("#account-status").textContent = "Sign in or create an account before starting a booking.";
  document.querySelector("#account-email").focus();
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
    next.disabled = true;
    hint.classList.remove("error");
    hint.textContent = "Checking the address…";
    showMapSearch(state.address);
    try {
      const result = await locateAddress(state.address);
      if (!result) throw new Error("We couldn’t locate that address. Check the street, number, and borough.");
      showAddressResult(result);
      if (!result.inPilot) {
        hint.textContent = "Not available yet—this address is outside the active Admin-approved regions.";
        hint.classList.add("error");
        next.disabled = false;
        return;
      }
      hint.textContent = "Good news—this address is in the pilot service area.";
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
      state.bookingId = await saveBooking();
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
document.querySelector("#pay-booking-button").addEventListener("click", async () => {
  await startPayment(state.bookingId, document.querySelector("#payment-status"));
});
async function startPayment(bookingId, status) {
  if (!supabaseClient || !currentUser || !bookingId) {
    status.textContent = "Sign in and create a booking before starting payment.";
    status.classList.add("error");
    return;
  }
  status.textContent = "Opening secure checkout…";
  status.classList.remove("error");
  const { data, error } = await supabaseClient.functions.invoke("create-checkout-session", { body: { booking_id: bookingId } });
  if (error || !data?.url) {
    status.textContent = error?.message || "Secure checkout is not configured yet.";
    status.classList.add("error");
    return;
  }
  window.location.href = data.url;
}
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
    loadLockbox();
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
document.querySelector("#book-appointment-button").addEventListener("click", startBooking);
headerBookButton.addEventListener("click", openBookingEntry);
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
document.querySelector("#account-address").addEventListener("input", event => {
  verifiedAccountAddress = "";
  clearTimeout(addressSearchTimer);
  addressSearchTimer = setTimeout(async () => {
    if (event.target.value.trim().length < 3) return;
    await suggestAddressesFor("account-address-suggestions", event.target.value);
  }, 350);
});
async function suggestAddressesFor(listId, value) {
  const response = await fetch(`https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest?f=json&maxSuggestions=5&text=${encodeURIComponent(`${value.trim()}, USA`)}`);
  if (!response.ok) return;
  const payload = await response.json();
  document.querySelector(`#${listId}`).innerHTML = (payload.suggestions || []).map(item => `<option value="${item.text}"></option>`).join("");
}
document.querySelector("#account-address").addEventListener("change", event => {
  if (event.target.value.trim()) document.querySelector("#verify-account-address").click();
});
document.querySelector("#verify-account-address").addEventListener("click", async () => {
  const input = document.querySelector("#account-address");
  const status = document.querySelector("#account-address-status");
  const address = input.value.trim();
  if (!address) {
    status.textContent = "Enter an address first.";
    status.classList.add("error");
    return;
  }
  status.textContent = "Looking up address…";
  try {
    const candidate = await lookupAddressCandidate(address);
    verifiedAccountAddress = candidate.address;
    input.value = candidate.address;
    const attrs = candidate.attributes || {};
    const { data: regions, error: regionError } = await supabaseClient
      .from("pilot_regions")
      .select("name,state,latitude,longitude,radius_miles")
      .eq("active", true);
    if (regionError) throw new Error("Address verified, but active-region availability could not be checked.");
    const matchedRegion = findRegionMatch(candidate.location.y, candidate.location.x, String(attrs.RegionAbbr || "").toUpperCase(), regions);
    status.textContent = matchedRegion
      ? `Address verified and available in ${matchedRegion.region.name} · ${matchedRegion.distance.toFixed(2)} miles from center.`
      : "Address verified, but it is outside the active Admin-approved regions.";
    status.classList.toggle("error", !matchedRegion);
    status.dataset.available = matchedRegion ? "true" : "false";
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("error");
  }
});
document.querySelector("#save-account-address").addEventListener("click", () => {
  const address = document.querySelector("#account-address").value.trim();
  const status = document.querySelector("#account-address-status");
  if (!address || address !== verifiedAccountAddress || status.dataset.available !== "true") {
    status.textContent = "Verify the address and confirm it is in an active service region before saving.";
    status.classList.add("error");
    return;
  }
  localStorage.setItem("kitchenResetAddress", address);
  document.querySelector("#address-street").value = address;
  status.textContent = "Address saved. It will be used for your next booking.";
  status.classList.remove("error");
});
async function loadLockbox() {
  if (!supabaseClient || !currentUser) return;
  const { data } = await supabaseClient.from("customer_lockboxes").select("instructions,confirmed").eq("user_id", currentUser.id).maybeSingle();
  if (data) {
    document.querySelector("#lockbox-instructions").value = data.instructions || "";
    document.querySelector("#lockbox-confirmed").checked = Boolean(data.confirmed);
  }
}
document.querySelector("#save-lockbox").addEventListener("click", async () => {
  const status = document.querySelector("#lockbox-status");
  const code = document.querySelector("#lockbox-code").value.trim();
  const instructions = document.querySelector("#lockbox-instructions").value.trim();
  const confirmed = document.querySelector("#lockbox-confirmed").checked;
  if (!/^\d{4,8}$/.test(code) || !instructions || !confirmed) {
    status.textContent = "Enter a 4–8 digit lockbox code, instructions, and confirm that you tested it.";
    status.classList.add("error");
    return;
  }
  const { error } = await supabaseClient.from("customer_lockboxes").upsert({ user_id: currentUser.id, access_code: code, instructions, confirmed, updated_at: new Date().toISOString() });
  status.textContent = error ? error.message : "Lockbox instructions saved. The code is only released during an active clean.";
  status.classList.toggle("error", Boolean(error));
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
      if (_event === "SIGNED_IN" && !currentUser.user_metadata?.password_set) showPasswordSetup();
      else openPage(accountPanel);
    } else {
      accountPanel.classList.add("hidden");
      setAuthView("email");
    }
    updateAdminAccess();
  });
}

document.querySelector("#close-pro").addEventListener("click", () => closePage(proPanel));
workerButton.addEventListener("click", () => {
  openPage(workerPanel);
  loadProfessionalRegions();
  loadWorkerPortal();
});
document.querySelector("#close-worker").addEventListener("click", () => closePage(workerPanel));
document.querySelector("#worker-availability").addEventListener("click", event => {
  const available = event.currentTarget.dataset.available !== "true";
  event.currentTarget.dataset.available = String(available);
  event.currentTarget.textContent = available ? "Go offline" : "Go available";
  document.querySelector("#worker-availability-label").textContent = available ? "Available" : "Offline";
  document.querySelector("#worker-status").textContent = available
    ? "You are marked available for new tri-state assignments."
    : "You are offline and will not be shown for new assignments.";
  saveWorkerAvailability(available);
});
document.querySelector("#save-worker-profile").addEventListener("click", () => {
  const name = document.querySelector("#worker-name").value.trim();
  const region = document.querySelector("#worker-region").value;
  const status = document.querySelector("#worker-profile-status");
  if (!name || !region) {
    status.textContent = "Add your name and choose a primary region.";
    status.classList.add("error");
    return;
  }
  saveWorkerProfile(name, region).catch(error => {
    status.textContent = error.message;
    status.classList.add("error");
  });
  document.querySelector("#connect-worker-payouts").addEventListener("click", async event => {
    const status = document.querySelector("#worker-profile-status");
    const button = event.currentTarget;
    button.disabled = true;
    status.textContent = "Opening secure payout setup…";
    const { data, error } = await supabaseClient.functions.invoke("create-connect-account-link");
    if (error || !data?.url) {
      status.textContent = error?.message || "Payout setup is not deployed yet.";
      status.classList.add("error");
      button.disabled = false;
      return;
    }
    window.location.href = data.url;
  });
});

async function loadWorkerPortal() {
  const status = document.querySelector("#worker-status");
  const assignments = document.querySelector("#worker-assignments");
  if (!supabaseClient || !currentUser) {
    status.textContent = "Sign in before opening the worker portal.";
    assignments.innerHTML = "<p class=\"field-hint\">No worker session is connected.</p>";
    return;
  }
  const { data: profile, error: profileError } = await supabaseClient
    .from("worker_profiles")
    .select("name,primary_region,available")
    .eq("user_id", currentUser.id)
    .maybeSingle();
  if (profileError) {
    status.textContent = `Worker setup is not enabled yet: ${profileError.message}`;
    return;
  }
  if (profile) {
    document.querySelector("#worker-name").value = profile.name;
    document.querySelector("#worker-region").value = profile.primary_region;
    const availability = document.querySelector("#worker-availability");
    availability.dataset.available = String(profile.available);
    availability.textContent = profile.available ? "Go offline" : "Go available";
    document.querySelector("#worker-availability-label").textContent = profile.available ? "Available" : "Offline";
    if (!profile.available) {
      status.textContent = "Save your worker profile, then choose Go available to load open jobs.";
    }
  }
  if (profile?.available) await loadWorkerJobs();
  else if (profile) assignments.innerHTML = "<p class=\"field-hint\">Go available to see open jobs.</p>";
  else assignments.innerHTML = "<p class=\"field-hint\">Save your worker profile to see open jobs.</p>";
  await loadAcceptedWorkerJobs();
}

async function loadWorkerJobs() {
  const assignments = document.querySelector("#worker-assignments");
  if (!supabaseClient || !currentUser) {
    assignments.innerHTML = "<p class=\"field-hint error\">Sign in before loading worker jobs.</p>";
    return;
  }
  assignments.innerHTML = "<p class=\"field-hint\">Loading available jobs…</p>";
  const { data, error } = await supabaseClient
    .from("bookings")
    .select("id,address,service_tier,price_cents,bonus_cents,duration_minutes,deadline,created_at")
    .eq("status", "matching")
    .is("worker_id", null)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) {
    assignments.innerHTML = `<p class="field-hint error">Jobs could not be loaded: ${error.message}</p>`;
    return;
  }
  const availability = document.querySelector("#worker-availability").dataset.available === "true";
  if (!availability) {
    assignments.innerHTML = "<p class=\"field-hint\">You are offline. Click Go available, then refresh jobs.</p>";
    return;
  }
  workerJobs.clear();
  data.forEach(job => workerJobs.set(job.id, job));
  assignments.innerHTML = data.length
    ? data.map(job => `<article class="worker-job"><strong>${job.service_tier} · $${((job.price_cents + job.bonus_cents) / 100).toFixed(0)}</strong><small>${job.address}<br>${job.deadline} · ${job.duration_minutes} minutes</small><details class="worker-job-details"><summary>Review job</summary><span>Service: ${job.service_tier}</span><span>Address: ${job.address}</span><span>Deadline: ${job.deadline}</span><span>Duration: ${job.duration_minutes} minutes</span><span>Customer payout: $${((job.price_cents + job.bonus_cents) / 100).toFixed(0)}</span><button class="primary-button worker-job-accept-inline" type="button" data-job-id="${job.id}">Accept job</button></details></article>`).join("")
    : "<p class=\"field-hint\">No open jobs are available right now.</p>";
  assignments.querySelectorAll(".worker-job-accept-inline").forEach(button => {
    button.addEventListener("click", () => acceptWorkerJob(button.dataset.jobId, button));
  });
  assignments.querySelectorAll(".worker-job-button").forEach(button => {
    button.addEventListener("click", () => showWorkerJobReview(button.dataset.jobId));
  });
}

async function loadAcceptedWorkerJobs() {
  const list = document.querySelector("#worker-accepted-jobs");
  if (!supabaseClient || !currentUser) return;
  const { data, error } = await supabaseClient
    .from("bookings")
    .select("id,user_id,address,service_tier,price_cents,bonus_cents,duration_minutes,deadline,status,created_at")
    .eq("worker_id", currentUser.id)
    .in("status", ["assigned", "in_progress", "completed"])
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) {
    list.innerHTML = `<p class="field-hint error">Accepted jobs could not be loaded: ${error.message}</p>`;
    return;
  }
  data.forEach(job => workerJobs.set(job.id, job));
  const { data: checkins } = data.length
    ? await supabaseClient.from("booking_checkins").select("booking_id,status").in("booking_id", data.map(job => job.id))
    : { data: [] };
  const checkinStatuses = new Map((checkins || []).map(checkin => [checkin.booking_id, checkin.status]));
  list.innerHTML = data.length
    ? data.map(job => {
      const status = workerStatusOverrides.get(job.id) || checkinStatuses.get(job.id) || job.status;
      const nextLabel = status === "assigned" ? "Mark en route" : status === "en_route" ? "Mark arrived" : status === "arrived" ? "Start clean" : status === "in_progress" ? "Complete clean" : "Completed";
      return `<article class="worker-job" data-accepted-job="${job.id}"><strong>${job.service_tier} · $${((job.price_cents + job.bonus_cents) / 100).toFixed(0)}</strong><small>${job.address}<br>${job.deadline} · ${job.duration_minutes} minutes</small><span class="booking-status">${status.replace("_", " ")}</span>${status !== "completed" ? `<button class="secondary-button worker-checkin" type="button" data-job-id="${job.id}" data-status="${status}">${nextLabel}</button>` : ""}${status === "in_progress" || status === "completed" ? `<label class="text-button worker-photo-label">Add finished photos<input class="worker-finished-photos hidden" type="file" accept="image/*" multiple data-job-id="${job.id}"></label><button class="secondary-button worker-submit-photos" type="button" data-job-id="${job.id}">Submit photos to client</button>` : ""}<button class="text-button worker-lockbox" type="button" data-job-id="${job.id}">Get lockbox access</button><p class="field-hint worker-job-status" data-status-for="${job.id}"></p></article>`;
    }).join("")
    : "<p class=\"field-hint\">No accepted jobs yet.</p>";
}
document.querySelector("#worker-accepted-jobs").addEventListener("click", async event => {
  const button = event.target.closest(".worker-checkin, .worker-lockbox, .worker-submit-photos");
  if (!button) return;
  const status = document.querySelector(`[data-status-for="${button.dataset.jobId}"]`);
  if (button.classList.contains("worker-submit-photos")) {
    const input = button.closest(".worker-job").querySelector(".worker-finished-photos");
    if (!input.files.length) {
      status.textContent = "Choose at least one finished photo first.";
      status.classList.add("error");
      return;
    }
    button.disabled = true;
    button.textContent = "Uploading…";
    let uploaded = 0;
    for (const file of input.files) {
      const job = workerJobs.get(button.dataset.jobId);
      if (!job) {
        status.textContent = "This booking is no longer available.";
        status.classList.add("error");
        button.disabled = false;
        button.textContent = "Submit photos to client";
        return;
      }
      const path = `${job.user_id}/${button.dataset.jobId}/finished-${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
      const upload = await supabaseClient.storage.from("booking-photos").upload(path, file, { contentType: file.type, upsert: false });
      if (upload.error) {
        status.textContent = `Photo upload failed: ${upload.error.message}`;
        status.classList.add("error");
        button.disabled = false;
        button.textContent = "Submit photos to client";
        return;
      }
      const photo = await supabaseClient.from("booking_photos").insert({
        booking_id: button.dataset.jobId,
        user_id: job.user_id,
        photo_type: "finished",
        storage_path: path
      });
      if (photo.error) {
        status.textContent = `Photo record failed: ${photo.error.message}`;
        status.classList.add("error");
        button.disabled = false;
        button.textContent = "Submit photos to client";
        return;
      }
      uploaded += 1;
    }
    status.textContent = `${uploaded} finished photo${uploaded === 1 ? "" : "s"} submitted to the client.`;
    status.classList.remove("error");
    button.disabled = false;
    button.textContent = "Submit more photos";
    return;
  }
  if (button.classList.contains("worker-lockbox")) {
    const { data, error } = await supabaseClient.rpc("get_active_lockbox_code", { target_booking: button.dataset.jobId });
    status.textContent = error ? error.message : `Lockbox code: ${data}. Use it only for this active clean.`;
    status.classList.toggle("error", Boolean(error));
    return;
  }
  const nextStatus = button.dataset.status === "assigned" ? "en_route" :
    button.dataset.status === "en_route" ? "arrived" :
    button.dataset.status === "arrived" ? "in_progress" : "completed";
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = "Updating…";
  const { data: updatedCheckin, error } = await supabaseClient.rpc("update_booking_checkin", { target_booking: button.dataset.jobId, next_status: nextStatus });
  status.textContent = error
    ? `Could not update status: ${error.message}${error.details ? ` (${error.details})` : ""}`
    : `Status updated to ${nextStatus.replace("_", " ")}.`;
  status.classList.toggle("error", Boolean(error));
  if (error) {
    button.disabled = false;
    button.textContent = originalLabel;
  }
  if (!error) {
    const savedCheckin = Array.isArray(updatedCheckin) ? updatedCheckin[0] : updatedCheckin;
    const { data: verifiedCheckin, error: verifyError } = await supabaseClient
      .from("booking_checkins")
      .select("status")
      .eq("booking_id", button.dataset.jobId)
      .maybeSingle();
    const savedStatus = verifiedCheckin?.status || savedCheckin?.status || nextStatus;
    workerStatusOverrides.set(button.dataset.jobId, savedStatus);
    const card = button.closest(".worker-job");
    const badge = card?.querySelector(".booking-status");
    const savedMessage = card?.querySelector(".worker-job-status");
    if (badge) badge.textContent = savedStatus.replace("_", " ");
    if (savedMessage) {
      savedMessage.textContent = verifyError
        ? `Status changed to ${savedStatus.replace("_", " ")}. Refresh to confirm it was saved.`
        : `Current status: ${savedStatus.replace("_", " ")}.`;
      savedMessage.classList.remove("error");
    }
    button.dataset.status = savedStatus;
    button.textContent = savedStatus === "en_route" ? "Mark arrived" : savedStatus === "arrived" ? "Start clean" : savedStatus === "in_progress" ? "Complete clean" : "Completed";
    if (savedStatus === "completed") {
      button.remove();
      if (!card.querySelector(".worker-submit-photos")) {
        card.querySelector(".worker-job-status").insertAdjacentHTML("beforebegin", `<label class="text-button worker-photo-label">Add finished photos<input class="worker-finished-photos hidden" type="file" accept="image/*" multiple data-job-id="${button.dataset.jobId}"></label><button class="secondary-button worker-submit-photos" type="button" data-job-id="${button.dataset.jobId}">Submit photos to client</button>`);
      }
      const payout = await supabaseClient.functions.invoke("create-worker-payout", { body: { booking_id: button.dataset.jobId } });
      if (payout.error) {
        status.textContent += ` Payout is pending: ${payout.error.message}`;
      } else {
        status.textContent += " Worker payout submitted.";
      }
    }
  }
});

function showWorkerJobReview(jobId) {
  const review = document.querySelector("#worker-job-review");
  const copy = document.querySelector("#worker-job-review-copy");
  const status = document.querySelector("#worker-job-review-status");
  const job = workerJobs.get(jobId);
  if (!job) {
    status.textContent = "This job is no longer available.";
    review.classList.remove("hidden");
    return;
  }
  review.dataset.jobId = job.id;
  copy.innerHTML = `<strong>${job.service_tier}</strong><br>${job.address}<br>${job.deadline} · ${job.duration_minutes} minutes<br>Customer payout: $${((job.price_cents + job.bonus_cents) / 100).toFixed(0)}`;
  status.textContent = "Review the address, deadline, duration, and payout before accepting.";
  review.classList.remove("hidden");
  review.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
document.querySelector("#close-worker-job-review").addEventListener("click", () => {
  document.querySelector("#worker-job-review").classList.add("hidden");
});
document.querySelector("#refresh-worker-jobs").addEventListener("click", loadWorkerJobs);
document.querySelector("#worker-job-accept").addEventListener("click", async () => {
  const review = document.querySelector("#worker-job-review");
  await acceptWorkerJob(review.dataset.jobId, document.querySelector("#worker-job-accept"));
});

async function acceptWorkerJob(jobId, button) {
  const status = document.querySelector("#worker-job-review-status");
  if (!currentUser || !jobId) return;
  button.disabled = true;
  const { error } = await supabaseClient.from("bookings")
    .update({ worker_id: currentUser.id, status: "assigned" })
    .eq("id", jobId)
    .eq("status", "matching")
    .is("worker_id", null);
  if (error) {
    status.textContent = `This job could not be accepted: ${error.message}`;
    status.classList.add("error");
    button.disabled = false;
    return;
  }
  status.textContent = "Job accepted.";
  status.classList.remove("error");
  loadWorkerJobs();
  loadAcceptedWorkerJobs();
}

async function saveWorkerProfile(name, region) {
  if (!supabaseClient || !currentUser) throw new Error("Sign in before saving a worker profile.");
  const { error } = await supabaseClient.from("worker_profiles").upsert({
    user_id: currentUser.id, name, primary_region: region, updated_at: new Date().toISOString()
  });
  if (error) throw error;
  const status = document.querySelector("#worker-profile-status");
  status.textContent = "Worker profile saved. Go available to receive open jobs.";
  status.classList.remove("error");
  loadWorkerJobs();
}

async function saveWorkerAvailability(available) {
  if (!supabaseClient || !currentUser) return;
  const name = document.querySelector("#worker-name").value.trim();
  const region = document.querySelector("#worker-region").value;
  if (available && (!name || !region)) {
    document.querySelector("#worker-availability").dataset.available = "false";
    document.querySelector("#worker-availability").textContent = "Go available";
    document.querySelector("#worker-availability-label").textContent = "Offline";
    document.querySelector("#worker-status").textContent = "Save your worker profile before going available.";
    return;
  }
  const { error } = await supabaseClient.from("worker_profiles").update({ available, updated_at: new Date().toISOString() }).eq("user_id", currentUser.id);
  if (error) document.querySelector("#worker-status").textContent = `Availability could not be saved: ${error.message}`;
  else loadWorkerJobs();
}
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
  let { data, error } = await supabaseClient.from("pilot_regions").select("id,name,borough,state,active,latitude,longitude,radius_miles").order("name");
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
    ? data.map(item => `<div class="admin-booking"><strong>${item.name}</strong><small>${item.borough}, ${item.state} · ${item.latitude != null ? `${item.radius_miles} mile radius` : "Needs map coordinates"} · ${item.active ? "Active" : "Inactive"}</small><div class="region-actions"><input class="region-radius text-field" data-id="${item.id}" type="number" min="0.25" max="25" step="0.25" value="${item.radius_miles ?? 3}" aria-label="Allowed radius for ${item.name}"><button class="text-button region-radius-save" data-id="${item.id}" type="button">Save distance</button><button class="text-button region-coordinates-refresh" data-id="${item.id}" data-name="${item.name}" data-borough="${item.borough}" data-state="${item.state}" type="button">Update map point</button><button class="text-button address-toggle" data-id="${item.id}" data-active="${item.active}" type="button">${item.active ? "Disable" : "Enable"}</button><button class="text-button address-delete" data-id="${item.id}" type="button">Delete permanently</button></div></div>`).join("")
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
  list.querySelectorAll(".region-radius-save").forEach(button => button.addEventListener("click", async () => {
    const input = list.querySelector(`.region-radius[data-id="${button.dataset.id}"]`);
    const radius = Number(input.value);
    if (!Number.isFinite(radius) || radius < 0.25 || radius > 25) {
      regionStatus.textContent = "Distance must be between 0.25 and 25 miles.";
      return;
    }
    button.disabled = true;
    const { error: updateError } = await supabaseClient
      .from("pilot_regions")
      .update({ radius_miles: radius })
      .eq("id", button.dataset.id);
    if (updateError) {
      regionStatus.textContent = `Unable to save distance: ${updateError.message}`;
      button.disabled = false;
    } else {
      loadPilotAddresses();
    }
  }));
  list.querySelectorAll(".region-coordinates-refresh").forEach(button => button.addEventListener("click", async () => {
    button.disabled = true;
    regionStatus.textContent = `Updating map point for ${button.dataset.name}…`;
    try {
      const candidate = await lookupAddressCandidate(`${button.dataset.name}, ${button.dataset.borough}, ${button.dataset.state}`);
      const state = String(candidate.attributes?.RegionAbbr || "").toUpperCase();
      if (state !== button.dataset.state || !candidate.location?.y || !candidate.location?.x) {
        throw new Error("The map service did not return a usable point in the configured state.");
      }
      const { error: updateError } = await supabaseClient
        .from("pilot_regions")
        .update({
          latitude: candidate.location.y,
          longitude: candidate.location.x,
          map_url: `https://www.openstreetmap.org/?mlat=${candidate.location.y}&mlon=${candidate.location.x}#map=13/${candidate.location.y}/${candidate.location.x}`
        })
        .eq("id", button.dataset.id);
      if (updateError) throw updateError;
      loadPilotAddresses();
    } catch (error) {
      regionStatus.textContent = `Unable to update map point: ${error.message}`;
      button.disabled = false;
    }
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
  if (!selectedAdminRegion) {
    document.querySelector("#admin-region-status").textContent = "Look up and confirm a map result before adding this region.";
    document.querySelector("#admin-region-status").classList.add("error");
    return;
  }
  const latitude = Number(document.querySelector("#pilot-latitude").value);
  const longitude = Number(document.querySelector("#pilot-longitude").value);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    document.querySelector("#admin-region-status").textContent = "Enter a valid latitude and longitude for the region map point.";
    document.querySelector("#admin-region-status").classList.add("error");
    return;
  }
  const { error } = await supabaseClient.from("pilot_regions").insert({
    name: selectedAdminRegion.name,
    borough: document.querySelector("#pilot-borough").value.trim(),
    state: selectedAdminRegion.state,
    latitude,
    longitude,
    radius_miles: Number(document.querySelector("#pilot-radius").value),
    description: document.querySelector("#pilot-description").value.trim() || null,
    map_url: `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=13/${latitude}/${longitude}`
  });
  if (error) {
    document.querySelector("#admin-status").textContent = error.message;
    return;
  }
  event.target.reset();
  selectedAdminRegion = null;
  document.querySelector("#admin-region-map").classList.add("hidden");
  document.querySelector("#admin-region-status").textContent = "Region added. Search for another map location or manage it below.";
  loadPilotAddresses();
});

document.querySelector("#pilot-region").addEventListener("input", event => {
  selectedAdminRegion = null;
  clearTimeout(addressSearchTimer);
  addressSearchTimer = setTimeout(() => suggestAddressesFor("region-suggestions", event.target.value).catch(() => {}), 350);
});
document.querySelector("#lookup-admin-region").addEventListener("click", async () => {
  const input = document.querySelector("#pilot-region");
  const status = document.querySelector("#admin-region-status");
  if (input.value.trim().length < 3) {
    status.textContent = "Enter a neighborhood, city, or county first.";
    status.classList.add("error");
    return;
  }
  status.textContent = "Looking up region on the map database…";
  try {
    const searchText = input.value.trim();
    const candidate = await lookupRegionCandidate(searchText);
    const attrs = candidate.attributes || {};
    const regionValue = String(attrs.RegionAbbr || attrs.RegionCode || attrs.Region || candidate.address.match(/\b(NY|NJ|CT)\b/i)?.[1] || "").toUpperCase();
    const state = { "NEW YORK": "NY", "NEW JERSEY": "NJ", CONNECTICUT: "CT" }[regionValue] || regionValue;
    const county = attrs.Subregion && /county$/i.test(attrs.Subregion) ? attrs.Subregion : "";
    const borough = county || attrs.District || attrs.City || attrs.PlaceName || "";
    const addressType = String(attrs.Type || attrs.Addr_type || "").toLowerCase();
    const regionName = county || (/\bcounty\b/i.test(searchText)
      ? searchText.replace(/\s*,\s*(NY|NJ|CT|New York|New Jersey|Connecticut)\b.*$/i, "").trim()
      : attrs.Nbrhd || attrs.PlaceName || attrs.City || attrs.District || searchText);
    const isStateOnly = ["state", "region"].includes(addressType) || (!county && !attrs.City && !attrs.District && !attrs.Nbrhd && !attrs.PlaceName);
    if (!["NY", "NJ", "CT"].includes(state) || !borough || isStateOnly) {
      throw new Error("Choose a specific neighborhood, city, or county in NY, NJ, or CT—not the whole state.");
    }
    selectedAdminRegion = {
      name: regionName,
      borough,
      state,
      lat: candidate.location.y,
      lon: candidate.location.x
    };
    input.value = searchText;
    document.querySelector("#pilot-borough").value = selectedAdminRegion.borough;
    document.querySelector("#pilot-state").value = selectedAdminRegion.state;
    document.querySelector("#pilot-latitude").value = selectedAdminRegion.lat;
    document.querySelector("#pilot-longitude").value = selectedAdminRegion.lon;
    if (document.querySelector("#pilot-state").value !== selectedAdminRegion.state) {
      throw new Error("The map result returned an unsupported state.");
    }
    document.querySelector("#pilot-map-url").value = `https://www.openstreetmap.org/?mlat=${selectedAdminRegion.lat}&mlon=${selectedAdminRegion.lon}#map=13/${selectedAdminRegion.lat}/${selectedAdminRegion.lon}`;
    const bbox = `${selectedAdminRegion.lon - 0.04},${selectedAdminRegion.lat - 0.03},${selectedAdminRegion.lon + 0.04},${selectedAdminRegion.lat + 0.03}`;
    const frame = document.querySelector("#admin-region-map");
    frame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${selectedAdminRegion.lat}%2C${selectedAdminRegion.lon}`;
    frame.classList.remove("hidden");
    status.textContent = `Map region selected: ${selectedAdminRegion.name} · ${selectedAdminRegion.state}. The radius will be measured from this exact map point.`;
    status.classList.remove("error");
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("error");
  }
});

async function loadProfessionalRegions() {
  const select = document.querySelector("#pro-region");
  const workerSelect = document.querySelector("#worker-region");
  const { data } = supabaseClient
    ? await supabaseClient.from("pilot_regions").select("name,borough,state").eq("active", true).order("name")
    : { data: null };
  const regions = data || [];
  select.innerHTML = '<option value="">Choose an active region</option>' +
    regions.map(region => `<option value="${region.name}">${region.name} · ${region.borough}, ${region.state}</option>`).join("");
  if (workerSelect) {
    workerSelect.innerHTML = '<option value="">Choose an active region</option>' +
      regions.map(region => `<option value="${region.name}">${region.name} · ${region.borough}, ${region.state}</option>`).join("");
    const savedProfile = JSON.parse(localStorage.getItem("kitchenResetWorkerProfile") || "null");
    if (savedProfile) {
      document.querySelector("#worker-name").value = savedProfile.name || "";
      workerSelect.value = savedProfile.region || "";
    }
  }
  const savedAddress = localStorage.getItem("kitchenResetAddress");
  if (savedAddress) document.querySelector("#address-street").value = savedAddress;
}
loadProfessionalRegions();

async function loadAccountBookings() {
  const status = document.querySelector("#account-customer-status");
  const list = document.querySelector("#account-customer-bookings");
  if (!supabaseClient || !currentUser) return;
  const { data, error } = await supabaseClient.from("bookings").select("id,service_tier,address,price_cents,bonus_cents,deadline,status,payment_status,paid_at").order("created_at", { ascending: false }).limit(20);
  if (error) {
    status.textContent = error.message;
    return;
  }
  const bookingIds = data.map(booking => booking.id);
  const { data: photos } = bookingIds.length
    ? await supabaseClient.from("booking_photos").select("booking_id,storage_path,photo_type").in("booking_id", bookingIds).eq("photo_type", "finished")
    : { data: [] };
  const photoLinks = new Map();
  for (const photo of photos || []) {
    const { data: signed } = await supabaseClient.storage.from("booking-photos").createSignedUrl(photo.storage_path, 3600);
    if (signed?.signedUrl) {
      if (!photoLinks.has(photo.booking_id)) photoLinks.set(photo.booking_id, []);
      photoLinks.get(photo.booking_id).push(signed.signedUrl);
    }
  }
  status.textContent = `${data.length} booking${data.length === 1 ? "" : "s"}`;
  list.innerHTML = data.length ? data.map(booking => {
    const paymentStatus = booking.payment_status || "pending";
    const paymentLabel = paymentStatus === "paid" ? "Paid" : paymentStatus === "failed" ? "Payment failed" : paymentStatus === "refunded" ? "Refunded" : "Payment needed";
    const finished = (photoLinks.get(booking.id) || []).map(url => `<a href="${url}" target="_blank" rel="noopener"><img class="booking-photo" src="${url}" alt="Finished kitchen photo"></a>`).join("");
    return `<article class="booking-card"><strong>${booking.service_tier} · $${((booking.price_cents + booking.bonus_cents) / 100).toFixed(0)}</strong><small>${booking.address}<br>${booking.deadline}</small><span class="booking-status">${booking.status}</span><span class="booking-status">${paymentLabel}</span>${paymentStatus !== "paid" ? `<button class="secondary-button booking-pay-button" type="button" data-booking-id="${booking.id}">Pay securely</button>` : ""}${finished ? `<div class="booking-photos">${finished}</div>` : ""}</article>`;
  }).join("") : "<p class=\"field-hint\">You have no bookings yet.</p>";
}
document.querySelector("#account-customer-bookings").addEventListener("click", async event => {
  const button = event.target.closest(".booking-pay-button");
  if (!button) return;
  button.disabled = true;
  button.textContent = "Opening checkout…";
  const message = document.createElement("p");
  message.className = "field-hint";
  button.after(message);
  await startPayment(button.dataset.bookingId, message);
  if (message.classList.contains("error")) {
    button.disabled = false;
    button.textContent = "Pay securely";
  }
});

async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment");
  const bookingId = params.get("booking");
  if (!payment || !bookingId) return;
  if (payment === "success") {
    document.querySelector("#payment-status").textContent = "Payment received. Refresh your Account in a few seconds while Stripe confirms it.";
    document.querySelector("#payment-status").classList.remove("error");
  } else if (payment === "cancelled") {
    document.querySelector("#payment-status").textContent = "Payment was cancelled. You can return to Account and try again.";
  }
  if (currentUser) {
    openPage(accountPanel);
    await loadAccountBookings();
  }
  history.replaceState({}, document.title, window.location.pathname);
}


adminButton.addEventListener("click", () => {
  openPage(adminPanel);
  loadAdminBookings();
});
document.querySelector("#close-admin").addEventListener("click", () => closePage(adminPanel));

updateAccountButton();
showStep(1);
handlePaymentReturn();
