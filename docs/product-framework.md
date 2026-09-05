# Kitchen Reset — Product Framework

**Status:** Draft 0.1  
**Launch market:** selected regions across New York, New Jersey, and Connecticut
**Product promise:** Book a trusted Kitchen Reset Pro to make your kitchen usable again, without spending your evening doing dishes.

## 1. The problem and customer

Busy people in small NYC apartments can accumulate dishes quickly, have little counter space, and do not have time or energy to reset their kitchen. They need a reliable, low-friction service—not a full-house cleaning appointment.

### Primary customer

A working professional or household in a small apartment who cooks regularly and values a recurring weekly or twice-weekly kitchen reset.

### Primary job to be done

> When my sink and counters have become unusable, help me get my kitchen reset at a predictable price and time, with someone I trust in my home.

## 2. MVP outcome

Prove that recurring Kitchen Reset bookings can be delivered safely, on time, and profitably inside selected tri-state service zones.

The MVP is successful when, after a defined pilot period, we can show:

| Measure | Initial target | Why it matters |
| --- | --- | --- |
| Completed bookings | 50+ pilot jobs | Enough real operations data |
| On-time arrival | 90%+ | Trust is the core promise |
| Rebooking | 30%+ of pilot customers | Indicates recurring value |
| Job estimate accuracy | 80% within the booked time band | Validates photo-assisted intake |
| Worker shift utilization | Track from day one | Determines viability of dense routing |
| Serious safety/quality incidents | 0 | Non-negotiable |

Targets are hypotheses for the pilot, not public promises.

## 3. The MVP service

### Included: Kitchen Reset

- Wash dishes, cookware, and utensils that the customer designates
- Dry and put items away using customer directions
- Clear the sink and wipe the immediate sink/counter area
- Optional customer-provided supplies or a standardized worker kit
- AI-assisted mess assessment that recommends a service band and quote
- A clear all-in quote before booking; jobs materially outside the assessed scope require customer approval before extra work

### Service policy needed before accepting bookings

- Accepted and prohibited items/materials
- Food-scraping and sanitation expectations
- Breakage, damage, cancellation, late-arrival, and rework policy
- Access, keys, pets, guests, and identity-verification policy
- Worker safety and stop-work policy
- Customer consent for photo intake and automatic image deletion period

## 4. Scope guardrails

### Build in MVP

| Customer | Worker | Operations |
| --- | --- | --- |
| Account and address | Application/onboarding status | Service-zone management |
| Upload photos for an AI-assisted mess assessment | Availability | Manual worker assignment |
| Select an available arrival window | View job details, estimate, and payout | Booking and issue dashboard |
| Mess-based all-in quote | Accept/decline a job with visible payout | Refund/rebook support workflow |
| Card payment, receipt, tip, rating | Earnings history | Basic reporting |
| Choose a desired completion deadline and receive risk alerts | Navigation link | Deadline-risk queue and escalation controls |
| Add an optional urgency bonus when a deadline is at risk | See guaranteed base payout plus any urgency bonus | Manual pricing adjustments |

### Explicitly out of scope for MVP

- Permanently installed or continuously recording cameras
- Autonomous dispatching and route optimization
- Dynamic/surge pricing or worker-entered bids
- Full home cleaning, laundry, meal prep, or organization services
- Restaurant/commercial kitchen service
- Broad multi-state coverage beyond the selected tri-state service zones
- Subscription plans before recurring demand is demonstrated
- In-app chat, social/referral programs, loyalty points, or gamification
- Unreviewable AI pricing: low-confidence estimates must be reviewed

### Later, only if the pilot proves the prerequisite

| Feature | Prerequisite |
| --- | --- |
| Recurring bookings | Reliable service quality and repeat demand |
| Automatic matching/routing | Sufficient job density and reliable worker availability |
| Subscription | Repeat usage and clear cancellation economics |
| More neighborhoods | Positive unit economics in the first zone |
| Advanced vision estimate | Photo estimates demonstrably reduce manual work/errors |
| Hardware/camera option | Explicit customer demand plus completed privacy/security/legal review |

## 5. Product principles

1. **Trust before convenience.** Clear worker identity, arrival status, policies, and support take priority over clever automation.
2. **A kitchen reset—not endless scope.** The worker can complete a small, well-defined job exceptionally well.
3. **Predictable beats cheap.** Show what is included, the time band, and the total price before booking.
4. **Human operations early.** Automate only after the manual workflow is stable and measured.
5. **Privacy by default.** Customer-initiated photos only; collect the least data necessary; set and communicate deletion rules.
6. **Density wins.** Protect worker time with small zones, scheduling buffers, and a minimum service length.

## 6. Core journey

1. Customer enters an eligible address.
2. Customer uploads sink photos and notes, then selects an available arrival window.
3. AI assesses the mess and recommends a service duration, price, and confidence level. Low-confidence estimates go to operations review.
4. Customer sees the all-in price and confirms payment.
5. A vetted worker sees the job summary, estimated duration, location area, and guaranteed payout, then accepts or declines. Operations assigns manually if needed; customer receives worker/arrival details.
6. Worker arrives, follows the service checklist, and confirms completion with customer-approved evidence.
7. If assignment or arrival jeopardizes the selected completion deadline, the customer receives a clear risk alert and choices: keep the booking, offer an urgency bonus, select a later deadline, or cancel under the stated policy.
8. Customer rates, tips, reports an issue, or books again.

## 7. Operating assumptions to validate

- The initial zone can produce multiple nearby jobs per worker shift.
- Customers will submit photos when they receive a fast, fair quote and understand privacy controls.
- The AI can reliably place most jobs into a small number of service/price tiers; uncertain images are reviewed rather than automatically priced.
- The minimum-priced tier leaves enough margin after travel, supplies, payment fees, support, and worker compensation.
- Deadline-risk alerts are early and accurate enough for customers to make a meaningful choice before their requested completion time.
- Repeat demand is concentrated around evenings and weekends.
- Trust signals and a simple rework policy matter more than real-time marketplace choice at launch.

## 8. Decisions we must make before development

- Brand/name and legal business entity
- Exact initial neighborhood boundaries
- Employee vs. independent-contractor model, with NY labor counsel
- Worker screening, insurance, training, and supplies model
- Mess-assessment rubric, price tiers, worker payout floor, and out-of-scope/overtime handling
- Deadline-risk thresholds, cancellation/refund rules, and urgency-bonus limits
- Payment provider and payout workflow
- Photo retention/deletion policy and privacy notice
- Customer support hours and escalation owner

## 9. Release sequence

### Phase 0 — Concierge validation

Landing page, waitlist, intake form, manual scheduling, and manual payments/receipts where legally appropriate. Interview customers and run a limited set of supervised jobs before building a marketplace.

**Exit condition:** demand, service checklist, timings, and price assumptions are validated with real bookings.

### Phase 1 — Pilot app

Customer booking flow, worker job view, operations dashboard, payment, basic notifications, and AI-assisted mess-based quote. Workers accept or decline a posted guaranteed payout; assignment remains manual.

**Exit condition:** 50+ completed jobs, 30%+ rebooking, 90%+ on-time arrival, no serious safety/quality incidents.

### Phase 2 — Repeatability

Recurring booking, improved operations tools, retention messaging, and limited automatic matching only if job density supports it.

### Phase 3 — Scale

Expand zone-by-zone, add route optimization, and consider additional services only when they do not weaken the Kitchen Reset promise.

## 10. Feature decision template

Every proposed feature must answer these before it enters the backlog:

```text
Feature:
Customer/worker problem solved:
MVP outcome or metric affected:
Release phase:
Smallest test or manual workaround:
Privacy, safety, legal, and operational risks:
Owner and decision date:
```

If it does not improve trust, booking conversion, fulfillment quality, repeat use, or worker utilization in the initial zone, it stays out of the MVP.

## 11. AI-assisted mess pricing

### Customer experience

1. The customer takes 2–4 guided photos: the sink, drying/counter area, and any cookware.
2. AI identifies visible workload signals—dish/item volume, cookware, food residue, sink/counter condition, and image confidence.
3. It places the job in a simple tier and shows an all-in quote before payment.
4. The quote states what is included and explains that a materially different job requires approval before additional work or charges.

### Pilot pricing model

Use a small fixed tier table rather than per-item pricing:

| Tier | Illustrative description | Customer sees | Worker sees |
| --- | --- | --- | --- |
| Light Reset | Small dish load; clear work area | All-in price and time window | Guaranteed payout and estimate |
| Standard Reset | Typical accumulated sink load | All-in price and time window | Guaranteed payout and estimate |
| Deep Reset | Large load, cookware, or visibly heavy residue | All-in price and time window | Guaranteed payout and estimate |
| Review Needed | Unclear, unsafe, or unusually large job | Request for better photos or operations review | Not offered until confirmed |

Actual dollar amounts are set only after testing worker compensation, travel, supplies, payment fees, and desired margin.

### Worker acceptance rule

Workers do **not** submit competing bids in the MVP. Each offered job displays a guaranteed payout, estimated duration, job tier, approximate location, and customer notes. A worker accepts or declines that offer. This preserves a clear customer price and avoids a race to the bottom for workers.

### Safety and fairness controls

- Never infer a quote from personal traits or the customer's home beyond the visible work scope.
- Preserve submitted photos only for the stated operational period, then delete them according to the privacy policy.
- Let the worker flag a material mismatch before starting; operations/customer approval is required to alter scope or price.
- Track estimate error by tier and revise the rubric only from reviewed outcomes.

## 12. Deadline assurance and urgency bonuses

### Customer commitment

At booking, the customer chooses an arrival window and, where scheduling allows, a desired **completion deadline**. The app distinguishes clearly between:

- **Confirmed:** a worker is assigned and the current plan is expected to meet the deadline.
- **At risk:** no suitable worker is assigned, a worker is delayed, or the forecasted completion time exceeds the deadline.
- **Cannot meet deadline:** operations has determined the booked deadline is no longer feasible.

Do not promise a deadline until a worker is assigned and the route/time estimate supports it. The booking screen must state whether a time is requested or confirmed.

### Failsafe workflow

1. System continuously compares the requested deadline with assignment status, worker travel time, and estimated job duration.
2. When the deadline becomes at risk, send an in-app/push notification and, for near-term bookings, an SMS or operations call according to customer preference.
3. Explain the reason in plain language, the estimated completion range, and the available choices.
4. If no action is selected by the escalation cutoff, operations follows the customer's preselected fallback preference.
5. Log the alert, decision, offers, and final outcome for service-reliability reporting.

### Customer choices in an at-risk alert

| Choice | What happens |
| --- | --- |
| Keep current offer | Continue matching at the existing guaranteed worker payout. |
| Add urgency bonus | Customer chooses from clear preset bonus amounts. The entire bonus is added to the accepting worker's guaranteed payout and is displayed before acceptance. |
| Move the deadline | Show available later arrival/completion options and any updated price. |
| Cancel | Apply the clearly stated cancellation/refund rule; no penalty if the platform cannot meet a confirmed commitment. |

### Guardrails

- The urgency bonus is optional, never presented as the only remedy, and must not be used to charge the customer without an explicit confirmation.
- Bonuses use predefined, capped amounts in the pilot—no free-form bidding or worker negotiation.
- A worker sees base payout, urgency bonus, total guaranteed payout, and expected duration separately.
- The customer can set a maximum bonus and fallback preference at booking (for example: “notify me first” or “do not offer a bonus”).
- Operations may add a platform-funded incentive to recover a service failure; it is never hidden as a customer charge.
- Once a worker has accepted, the urgency bonus is earned under the stated completion/cancellation policy.

### Pilot metrics

- Percentage of bookings that enter at-risk status
- Median warning time before the deadline
- Urgency-bonus acceptance rate and time-to-assignment
- Deadline completion rate, with and without a bonus
- Customer cancellation/refund rate after an alert
- Worker acceptance rate by payout and job tier
