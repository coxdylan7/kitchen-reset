# Kitchen Reset — AI Intake Rubric

**Status:** Pilot draft 0.1  
**Purpose:** Turn customer-submitted kitchen photos into a reliable starting quote, while routing uncertain work to operations review.

This rubric estimates the visible work. It does not judge cleanliness, household type, income, race, age, disability, or any other personal trait.

## 1. Customer photo flow

The app asks for guided, customer-initiated photos before showing a quote:

1. **Sink view:** show the full sink, including anything inside it.
2. **Counter/drying view:** show dishes beside the sink, drying rack, and immediate work area.
3. **Cookware view:** show pots, pans, baking items, and large containers not visible in the first two photos.
4. **Optional wide view:** requested only if the AI cannot see the full workload.

The camera guide should show framing examples and say: “Please include only the dishes and immediate kitchen work area. Do not include people, personal documents, or other rooms.”

## 2. Required image-quality checks

Do not price automatically when any required view is missing, too dark, too blurry, badly cropped, has significant glare, or does not show the relevant work area.

The system returns one of these messages:

| Result | Customer message | Next action |
| --- | --- | --- |
| Better photo needed | “We can’t clearly see the full dish load yet.” | Ask for a retake with a framing guide. |
| Manual review | “This job needs a quick review before we quote it.” | Operations reviews or follows up. |
| Not eligible | “This job is outside our current Kitchen Reset service.” | Explain the issue and do not offer the job. |

## 3. Visible-work scoring

The system scores four observable inputs. An AI vision model can propose these values, but the pilot logs the proposed values and keeps them reviewable.

### A. Dish units

Count visible plates, bowls, cups/glasses, mugs, utensils in a grouped cluster, and food-storage containers as **one dish unit each**. Do not claim an exact count if items overlap; use a range and lower confidence.

| Visible dish units | Points |
| --- | --- |
| 0–10 | 1 |
| 11–25 | 2 |
| 26–40 | 3 |
| More than 40 or cannot estimate | Manual review |

### B. Cookware and oversized items

Count pots, pans, baking dishes, blender parts, and oversized containers separately.

| Visible cookware/oversized items | Points |
| --- | --- |
| 0 | 0 |
| 1–2 | 1 |
| 3–5 | 2 |
| More than 5 or a commercial-size item | Manual review |

### C. Food residue and soaking need

| Visible condition | Points |
| --- | --- |
| Rinsed or light residue | 0 |
| Dried-on food on some items or one item likely needs soaking | 1 |
| Heavy baked-on residue, grease, mold, pests, or unknown substance | Manual review |

### D. Work-area condition

| Visible condition | Points |
| --- | --- |
| Sink and immediate counter accessible | 0 |
| Some dishes on counter/drying rack or limited working space | 1 |
| Sink/counter blocked beyond the visible dish load, sharp hazard, broken glass, or sanitation concern | Manual review |

## 4. Tier assignment

Only assign a tier when every required image passes quality checks and the image-confidence score is at least the pilot threshold (initially 85%).

| Tier | Score | Additional rule | Quote behavior |
| --- | --- | --- |
| Light Reset | 1–2 | No more than 10 dish units, 0–1 cookware item, and no soaking need | Show Light price and estimated duration. |
| Standard Reset | 3–5 | No manual-review trigger | Show Standard price and estimated duration. |
| Deep Reset | 6–7 | No manual-review trigger; no more than 40 dish units or 5 cookware items | Show Deep price and estimated duration. |
| Review Needed | Any manual-review trigger, score above 7, or confidence below threshold | Do not auto-quote | Ask for better photos or send to operations. |

The tier prices and durations are controlled by the current pricing model; this document contains no public price promise.

## 5. AI output contract

The assessment service must return structured values—not only free-form text:

```text
assessment_status: quoted | better_photo_needed | manual_review | not_eligible
image_confidence: 0.00–1.00
dish_unit_range: minimum–maximum
cookware_count_range: minimum–maximum
residue_level: light | moderate | review_needed
work_area_level: accessible | limited | review_needed
recommended_tier: light | standard | deep | none
reason_codes: list of controlled codes
customer_message: plain-language explanation
worker_summary: visible-work summary and limitations
```

Reason codes must be chosen from a controlled list, such as `LOW_LIGHT`, `PARTIAL_SINK_VIEW`, `DISH_COUNT_UNCERTAIN`, `HEAVY_RESIDUE`, `BROKEN_GLASS`, or `OUT_OF_SCOPE_ITEM`.

## 6. Worker handoff and mismatch rule

Before accepting, a worker sees the tier, estimated duration, guaranteed payout, approximate location, customer notes, and an image-derived work summary. They do not see AI confidence as a reason to distrust the customer; they see only useful scope information.

On arrival, the worker chooses one of:

- **Matches estimate:** begin the job.
- **Minor difference:** begin work and log the difference; no customer price change.
- **Material mismatch:** pause before beginning and choose a reason code. Operations contacts the customer to approve a new tier, a later completion time, or cancellation.
- **Unsafe/out of scope:** do not begin; follow the safety and support workflow.

A worker cannot add a charge or alter the customer quote unilaterally.

## 7. Pilot review loop

For every completed pilot job, record the original assessment, worker-reported actual duration, mismatch status, final tier, and customer outcome.

Review weekly:

- Tier accuracy: share of jobs that match the worker’s actual scope.
- Duration error by tier.
- Manual-review and retake rate.
- Worker mismatch rate and top reason codes.
- Customer cancellation rate after a quote.
- Any safety, privacy, or fairness incident.

Do not retrain or loosen the scoring thresholds until reviewed data shows that the change improves estimate accuracy without increasing mismatches or safety issues.

## 8. Privacy and retention

- Capture only customer-initiated photos; never use a continuously recording camera in the MVP.
- Explain why photos are used before capture and collect only the immediate kitchen work area.
- Encrypt photos in transit and at rest.
- Restrict access to assigned workers and authorized operations staff.
- Delete source images under the published retention schedule; retain only the minimum de-identified assessment data needed for pilot analysis where lawful.
