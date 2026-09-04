const state = { step: 1, address: "", photos: 0, tier: { name: "Standard Reset", price: 79, duration: 70 }, deadline: "Today by 7:00 PM", bonus: 0 };
const labels = ["Address", "Photos", "Your quote", "Deadline", "Review", "Booked"];
const next = document.querySelector("#next");
const back = document.querySelector("#back");
const screens = ["address", "photos", "quote", "schedule", "confirm", "success"];

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
  if (!card.classList.contains("uploaded") && event.target.files.length) state.photos += 1;
  card.classList.add("uploaded");
  card.querySelector("strong").textContent = "Photo added";
  card.querySelector("small").textContent = "Ready";
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

next.addEventListener("click", () => {
  if (state.step === 1) {
    state.address = document.querySelector("#address").value.trim();
    const hint = document.querySelector("#address-hint");
    if (!state.address) { hint.textContent = "Please enter an address to check service availability."; hint.classList.add("error"); return; }
    hint.textContent = "Good news—this address is in the pilot service area.";
  }
  if (state.step === 2) updateQuote();
  if (state.step === 4) updateSummary();
  if (state.step === 5) {
    document.querySelector("#booking-id").textContent = `KR-${Math.floor(10000 + Math.random() * 89999)}`;
    document.querySelector("#success-deadline").textContent = state.deadline;
    document.querySelector("#success-copy").textContent = `We’ll notify you as soon as your ${state.deadline} deadline is confirmed.`;
  }
  showStep(Math.min(state.step + 1, 6));
});
back.addEventListener("click", () => showStep(Math.max(state.step - 1, 1)));
document.querySelector("#restart").addEventListener("click", () => { state.step = 1; state.photos = 0; state.bonus = 0; document.querySelectorAll(".photo-card").forEach(card => { card.classList.remove("uploaded"); card.querySelector("strong").textContent = card.querySelector("small").textContent === "Optional" ? "Wide view" : card.querySelector("strong").textContent; }); showStep(1); });
showStep(1);
