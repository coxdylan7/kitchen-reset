const state = { step: 1, address: "", photos: 0, tier: { name: "Standard Reset", price: 79, duration: 70 }, deadline: "Today by 7:00 PM", bonus: 0 };
const labels = ["Address", "Photos", "Your quote", "Deadline", "Review", "Booked"];
const next = document.querySelector("#next");
const back = document.querySelector("#back");
const screens = ["address", "photos", "quote", "schedule", "confirm", "success"];
const accountButton = document.querySelector("#account-button");
const accountPanel = document.querySelector("#account-panel");
const supabaseConfig = window.KITCHEN_RESET_CONFIG;
let supabase = null;
let supabaseInitError = null;
if (supabaseConfig && !supabaseConfig.supabaseUrl.includes("YOUR-PROJECT")) {
  try {
    if (!window.supabase?.createClient) throw new Error("The Supabase client did not load.");
    supabase = window.supabase.createClient(supabaseConfig.supabaseUrl, supabaseConfig.supabaseAnonKey);
  } catch (error) {
    supabaseInitError = error;
  }
}
let currentUser = null;

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
  if (!supabase || !currentUser) return null;
  const { data: booking, error } = await supabase.from("bookings").insert({
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
    const upload = await supabase.storage.from("booking-photos").upload(path, file, { contentType: file.type, upsert: false });
    if (upload.error) throw upload.error;
    const photo = await supabase.from("booking_photos").insert({
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
    if (!/brooklyn|manhattan/i.test(state.address)) {
      hint.textContent = "We’re not in that area yet. Try a Brooklyn or Manhattan address for this pilot.";
      hint.classList.add("error");
      document.querySelector("#address-result").classList.add("hidden");
      return;
    }
    hint.classList.remove("error");
    hint.textContent = "Good news—this address is in the pilot service area.";
    document.querySelector("#address-result").classList.remove("hidden");
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
  const email = localStorage.getItem("kitchenResetEmail");
  accountButton.textContent = email ? email.split("@")[0] : "Sign in";
  accountButton.classList.toggle("signed-in", Boolean(email));
}

accountButton.addEventListener("click", () => {
  accountPanel.classList.toggle("hidden");
  if (!accountPanel.classList.contains("hidden")) document.querySelector("#account-email").focus();
});
document.querySelector("#close-account").addEventListener("click", () => accountPanel.classList.add("hidden"));
document.querySelector("#account-form").addEventListener("submit", event => {
  event.preventDefault();
  const email = document.querySelector("#account-email").value.trim();
  if (!supabase) {
    localStorage.setItem("kitchenResetEmail", email);
    document.querySelector("#account-status").textContent = supabaseInitError
      ? `Sign-in is temporarily unavailable: ${supabaseInitError.message}`
      : "Saved locally. Add Supabase config to enable account sync.";
    updateAccountButton();
    return;
  }
  supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin + window.location.pathname } })
    .then(({ error }) => {
      if (error) throw error;
      document.querySelector("#account-status").textContent = "Check your email for a secure sign-in link.";
    })
    .catch(error => { document.querySelector("#account-status").textContent = error.message; });
});

if (supabase) {
  supabase.auth.getUser().then(({ data }) => {
    currentUser = data.user;
    if (currentUser) {
      localStorage.setItem("kitchenResetEmail", currentUser.email);
      updateAccountButton();
    }
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    if (currentUser) {
      localStorage.setItem("kitchenResetEmail", currentUser.email);
      updateAccountButton();
    }
  });
}

updateAccountButton();
showStep(1);
