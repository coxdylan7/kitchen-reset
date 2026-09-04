import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "/home/djc/Work/kitchen-reset/outputs/thread-20260904";
await fs.mkdir(outputDir, { recursive: true });

const wb = Workbook.create();
const summary = wb.worksheets.add("Pricing Model");
const inputs = wb.worksheets.add("Assumptions");
const sources = wb.worksheets.add("Sources");

const navy = "#1F3A5F";
const blue = "#DCE6F1";
const amber = "#FFF2CC";
const paleGreen = "#E2F0D9";
const paleRed = "#FCE4D6";
const gray = "#666666";
const white = "#FFFFFF";
const thin = { preset: "all", style: "thin", color: "#D9E1F2" };
const dollar = '$#,##0.00;($#,##0.00);-';
const pct = '0.0%;(0.0%);-';
const num = '#,##0.0;(#,##0.0);-';

function title(sheet, text, subtitle, lastCol) {
  sheet.getRange(`A1:${lastCol}1`).merge();
  sheet.getRange("A1").values = [[text]];
  sheet.getRange("A1").format = { font: { name: "Arial", size: 16, bold: true, color: navy } };
  sheet.getRange(`A2:${lastCol}2`).merge();
  sheet.getRange("A2").values = [[subtitle]];
  sheet.getRange("A2").format = { font: { name: "Arial", size: 10, italic: true, color: gray }, wrapText: true };
}
function header(sheet, range) {
  sheet.getRange(range).format = { fill: navy, font: { name: "Arial", size: 10, bold: true, color: white }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true, borders: thin };
}
function section(sheet, row, label, lastCol) {
  sheet.getRange(`A${row}:${lastCol}${row}`).merge();
  sheet.getRange(`A${row}`).values = [[label]];
  sheet.getRange(`A${row}:${lastCol}${row}`).format = { fill: blue, font: { name: "Arial", size: 10, bold: true, color: navy }, borders: { preset: "outside", style: "thin", color: "#9FBAD0" } };
}

// Assumptions
inputs.showGridLines = false;
title(inputs, "Pilot Pricing Assumptions", "Edit amber cells only. All amounts are USD per completed booking unless noted.", "E");
section(inputs, 4, "Platform and Cost Assumptions", "E");
inputs.getRange("A5:E5").values = [["Assumption", "Value", "Unit", "Use", "Source / note"]];
header(inputs, "A5:E5");
inputs.getRange("A6:E13").values = [
  ["NYC minimum wage", 17, "$/hour", "Compliance floor reference", "NY State, effective 2026-01-01"],
  ["Target worker hourly earnings", 28, "$/active hour", "Pilot payout benchmark", "Founder hypothesis; validate with worker interviews"],
  ["Employer burden / protections reserve", 0.12, "% of worker payout", "Payroll taxes, insurance, benefits reserve", "Planning placeholder; legal/payroll review required"],
  ["Payment processing rate", 0.029, "% of customer charge", "Card processing", "Stripe standard domestic-card pricing"],
  ["Payment processing fixed fee", 0.30, "$/charge", "Card processing", "Stripe standard domestic-card pricing"],
  ["Support / quality reserve", 0.03, "% of customer charge", "Refunds, rework, support", "Pilot planning assumption"],
  ["Travel buffer", 15, "minutes/job", "Worker active-time estimate", "Pilot planning assumption"],
  ["Urgency bonus default", 0, "$/job", "Optional customer-paid incentive", "No bonus unless the customer explicitly adds one"],
];
inputs.getRange("A6:E13").format = { font: { name: "Arial", size: 10 }, verticalAlignment: "center", borders: thin };
inputs.getRange("B6:B13").format.fill = amber;
inputs.getRange("B6:B7").format.numberFormat = dollar;
inputs.getRange("B8:B8").format.numberFormat = pct;
inputs.getRange("B9:B10").format.numberFormat = pct;
inputs.getRange("B11:B11").format.numberFormat = dollar;
inputs.getRange("B12:B12").format.numberFormat = num;
inputs.getRange("B13:B13").format.numberFormat = dollar;

section(inputs, 16, "AI Pricing Tier Inputs", "E");
inputs.getRange("A17:E17").values = [["Tier", "Customer service price", "Estimated service minutes", "Base worker payout", "Supplies reserve"]];
header(inputs, "A17:E17");
inputs.getRange("A18:E20").values = [
  ["Light Reset", 49, 45, 28, 1.5],
  ["Standard Reset", 79, 70, 42, 2.5],
  ["Deep Reset", 119, 100, 60, 4],
];
inputs.getRange("A18:E20").format = { font: { name: "Arial", size: 10 }, borders: thin, verticalAlignment: "center" };
inputs.getRange("B18:E20").format.fill = amber;
inputs.getRange("B18:B20").format.numberFormat = dollar;
inputs.getRange("C18:C20").format.numberFormat = num;
inputs.getRange("D18:E20").format.numberFormat = dollar;

section(inputs, 23, "Urgency Bonus Presets", "E");
inputs.getRange("A24:E24").values = [["Preset", "Customer-paid bonus", "When offered", "Worker receives", "Note"]];
header(inputs, "A24:E24");
inputs.getRange("A25:E28").values = [
  ["None", 0, "Customer declines an incentive", "100% of bonus", "Normal matching continues"],
  ["Priority", 10, "Deadline is at risk", "100% of bonus", "Default pilot choice"],
  ["Urgent", 20, "Deadline is within a few hours", "100% of bonus", "Requires explicit customer approval"],
  ["Critical", 30, "Only after operations confirms need", "100% of bonus", "Pilot cap; review before offering"],
];
inputs.getRange("A25:E28").format = { font: { name: "Arial", size: 10 }, borders: thin, verticalAlignment: "center", wrapText: true };
inputs.getRange("B25:B28").format = { fill: amber, numberFormat: dollar };

inputs.getRange("A31:E34").merge();
inputs.getRange("A31").values = [["Model notes\n• Customer service price excludes an optional urgency bonus; the bonus is added to the customer charge and paid fully to the worker.\n• Contribution shown is before fixed overhead, marketing, insurance premiums, and taxes.\n• Minimum wage is a compliance reference, not a complete worker-cost calculation. Confirm worker classification and all employment obligations with NY counsel."]];
inputs.getRange("A31:E34").format = { fill: "#F3F6F8", font: { name: "Arial", size: 9, color: gray }, wrapText: true, verticalAlignment: "top", borders: thin };
inputs.getRange("A1:E34").format.font = { name: "Arial" };
inputs.getRange("A:A").format.columnWidth = 30;
inputs.getRange("B:B").format.columnWidth = 18;
inputs.getRange("C:C").format.columnWidth = 18;
inputs.getRange("D:D").format.columnWidth = 25;
inputs.getRange("E:E").format.columnWidth = 34;
inputs.getRange("2:2").format.rowHeight = 28;
inputs.freezePanes.freezeRows(5);
inputs.tabColor = "#C9B458";

// Pricing model
summary.showGridLines = false;
title(summary, "Kitchen Reset Pilot Pricing Model", "Formula-driven tier economics. Edit assumptions on the Assumptions tab; this page updates automatically.", "K");
section(summary, 4, "Pricing and Payout by AI-Assessed Tier", "K");
summary.getRange("A5:K5").values = [["Tier", "Service price", "Default urgency bonus", "Customer charge", "Estimated service minutes", "Worker active minutes", "Base worker payout", "Total worker payout", "Payment fee", "Contribution before overhead", "Contribution margin"]];
header(summary, "A5:K5");
summary.getRange("A6:A8").formulas = [["='Assumptions'!A18"], ["='Assumptions'!A19"], ["='Assumptions'!A20"]];
summary.getRange("B6:B8").formulas = [["='Assumptions'!B18"], ["='Assumptions'!B19"], ["='Assumptions'!B20"]];
summary.getRange("C6:C8").formulas = [["='Assumptions'!B13"], ["='Assumptions'!B13"], ["='Assumptions'!B13"]];
summary.getRange("D6:D8").formulas = [["=B6+C6"], ["=B7+C7"], ["=B8+C8"]];
summary.getRange("E6:E8").formulas = [["='Assumptions'!C18"], ["='Assumptions'!C19"], ["='Assumptions'!C20"]];
summary.getRange("F6:F8").formulas = [["=E6+'Assumptions'!B12"], ["=E7+'Assumptions'!B12"], ["=E8+'Assumptions'!B12"]];
summary.getRange("G6:G8").formulas = [["='Assumptions'!D18"], ["='Assumptions'!D19"], ["='Assumptions'!D20"]];
summary.getRange("H6:H8").formulas = [["=G6+C6"], ["=G7+C7"], ["=G8+C8"]];
summary.getRange("I6:I8").formulas = [["=D6*'Assumptions'!B9+'Assumptions'!B10"], ["=D7*'Assumptions'!B9+'Assumptions'!B10"], ["=D8*'Assumptions'!B9+'Assumptions'!B10"]];
summary.getRange("J6:J8").formulas = [["=D6-I6-H6*(1+'Assumptions'!B8)-'Assumptions'!E18-D6*'Assumptions'!B11"], ["=D7-I7-H7*(1+'Assumptions'!B8)-'Assumptions'!E19-D7*'Assumptions'!B11"], ["=D8-I8-H8*(1+'Assumptions'!B8)-'Assumptions'!E20-D8*'Assumptions'!B11"]];
summary.getRange("K6:K8").formulas = [["=J6/D6"], ["=J7/D7"], ["=J8/D8"]];
summary.getRange("A6:K8").format = { font: { name: "Arial", size: 10 }, borders: thin, verticalAlignment: "center" };
summary.getRange("B6:D8").format.numberFormat = dollar;
summary.getRange("E6:F8").format.numberFormat = num;
summary.getRange("G6:J8").format.numberFormat = dollar;
summary.getRange("K6:K8").format.numberFormat = pct;
summary.getRange("J6:K8").format.fill = paleGreen;

section(summary, 11, "Worker Economics and Customer Value", "K");
summary.getRange("A12:K12").values = [["Tier", "Worker payout / active hour", "Above NYC wage floor", "Service price / estimated hour", "Payment + support cost", "Supplies", "Employer burden reserve", "Contribution / active hour", "Minimum price for 20% margin", "Price gap vs. 20% floor", "Pricing signal"]];
header(summary, "A12:K12");
summary.getRange("A13:A15").formulas = [["=A6"], ["=A7"], ["=A8"]];
summary.getRange("B13:B15").formulas = [["=H6/(F6/60)"], ["=H7/(F7/60)"], ["=H8/(F8/60)"]];
summary.getRange("C13:C15").formulas = [["=B13-'Assumptions'!B6"], ["=B14-'Assumptions'!B6"], ["=B15-'Assumptions'!B6"]];
summary.getRange("D13:D15").formulas = [["=B6/(E6/60)"], ["=B7/(E7/60)"], ["=B8/(E8/60)"]];
summary.getRange("E13:E15").formulas = [["=I6+D6*'Assumptions'!B11"], ["=I7+D7*'Assumptions'!B11"], ["=I8+D8*'Assumptions'!B11"]];
summary.getRange("F13:F15").formulas = [["='Assumptions'!E18"], ["='Assumptions'!E19"], ["='Assumptions'!E20"]];
summary.getRange("G13:G15").formulas = [["=H6*'Assumptions'!B8"], ["=H7*'Assumptions'!B8"], ["=H8*'Assumptions'!B8"]];
summary.getRange("H13:H15").formulas = [["=J6/(F6/60)"], ["=J7/(F7/60)"], ["=J8/(F8/60)"]];
summary.getRange("I13:I15").formulas = [["=(H6*(1+'Assumptions'!B8)+'Assumptions'!E18+'Assumptions'!B10)/(1-'Assumptions'!B9-'Assumptions'!B11-0.2)"], ["=(H7*(1+'Assumptions'!B8)+'Assumptions'!E19+'Assumptions'!B10)/(1-'Assumptions'!B9-'Assumptions'!B11-0.2)"], ["=(H8*(1+'Assumptions'!B8)+'Assumptions'!E20+'Assumptions'!B10)/(1-'Assumptions'!B9-'Assumptions'!B11-0.2)"]];
summary.getRange("J13:J15").formulas = [["=B6-I13"], ["=B7-I14"], ["=B8-I15"]];
summary.getRange("K13:K15").formulas = [["=IF(J13>=0,\"At or above 20% floor\",\"Below 20% floor\")"], ["=IF(J14>=0,\"At or above 20% floor\",\"Below 20% floor\")"], ["=IF(J15>=0,\"At or above 20% floor\",\"Below 20% floor\")"]];
summary.getRange("A13:K15").format = { font: { name: "Arial", size: 10 }, borders: thin, verticalAlignment: "center" };
summary.getRange("B13:J15").format.numberFormat = dollar;
summary.getRange("K13:K15").format.wrapText = true;

section(summary, 18, "Urgency Bonus Logic", "K");
summary.getRange("A19:F19").values = [["Bonus preset", "Customer pays", "Worker receives", "Extra payment fee", "Net platform effect", "Offer rule"]];
header(summary, "A19:F19");
summary.getRange("A20:A23").formulas = [["='Assumptions'!A25"], ["='Assumptions'!A26"], ["='Assumptions'!A27"], ["='Assumptions'!A28"]];
summary.getRange("B20:B23").formulas = [["='Assumptions'!B25"], ["='Assumptions'!B26"], ["='Assumptions'!B27"], ["='Assumptions'!B28"]];
summary.getRange("C20:C23").formulas = [["=B20"], ["=B21"], ["=B22"], ["=B23"]];
summary.getRange("D20:D23").formulas = [["=B20*'Assumptions'!B9"], ["=B21*'Assumptions'!B9"], ["=B22*'Assumptions'!B9"], ["=B23*'Assumptions'!B9"]];
summary.getRange("E20:E23").formulas = [["=B20-C20-D20"], ["=B21-C21-D21"], ["=B22-C22-D22"], ["=B23-C23-D23"]];
summary.getRange("F20:F23").formulas = [["='Assumptions'!C25"], ["='Assumptions'!C26"], ["='Assumptions'!C27"], ["='Assumptions'!C28"]];
summary.getRange("A20:F23").format = { font: { name: "Arial", size: 10 }, borders: thin, verticalAlignment: "center", wrapText: true };
summary.getRange("B20:E23").format.numberFormat = dollar;
summary.getRange("E20:E23").format.fill = paleRed;

summary.getRange("A26:K29").merge();
summary.getRange("A26").values = [["How to use this model\n1. Start with the amber assumptions and change only values supported by pilot data.\n2. Keep customer price transparent: a customer approves any urgency bonus before it is added.\n3. Use contribution before overhead to test each tier; it excludes marketing, fixed technology, central operations, insurance premiums, and taxes.\n4. A bonus helps matching but reduces platform contribution by its processing fee. Treat it as a service-recovery tool, not revenue."]];
summary.getRange("A26:K29").format = { fill: "#F3F6F8", font: { name: "Arial", size: 10, color: gray }, wrapText: true, verticalAlignment: "top", borders: thin };
summary.getRange("A1:K29").format.font = { name: "Arial" };
summary.getRange("A:A").format.columnWidth = 18;
summary.getRange("B:J").format.columnWidth = 15;
summary.getRange("K:K").format.columnWidth = 22;
summary.getRange("2:2").format.rowHeight = 26;
summary.getRange("5:5").format.rowHeight = 32;
summary.getRange("12:12").format.rowHeight = 34;
summary.getRange("19:19").format.rowHeight = 28;
summary.freezePanes.freezeRows(5);
summary.tabColor = "#1F3A5F";

// Conditional formatting signals.
summary.getRange("K13:K15").conditionalFormats.add("containsText", { text: "Below", format: { fill: "#F4CCCC", font: { color: "#9C0006", bold: true } } });
summary.getRange("K13:K15").conditionalFormats.add("containsText", { text: "At or above", format: { fill: "#D9EAD3", font: { color: "#274E13", bold: true } } });

// Sources
sources.showGridLines = false;
title(sources, "Sources and Model Limits", "External references for sourced assumptions. All other inputs are clearly labeled pilot hypotheses.", "D");
sources.getRange("A4:D4").values = [["Input", "Value used", "Source URL", "Notes"]];
header(sources, "A4:D4");
sources.getRange("A5:D7").values = [
  ["NYC minimum wage", "$17.00/hour effective 2026-01-01", "https://www.ny.gov/programs/new-york-states-minimum-wage", "NYC, Long Island, and Westchester; used as compliance floor reference."],
  ["Card processing", "2.9% + $0.30", "https://stripe.com/pricing", "Standard domestic card pricing shown by Stripe; verify selected payment and marketplace products before launch."],
  ["Worker protections", "Not modeled in full", "https://www.nyc.gov/site/dca/about/paid-sick-leave-FAQs.page", "Domestic-service obligations can vary with engagement model. Obtain legal and payroll advice before operating."],
];
sources.getRange("A5:D7").format = { font: { name: "Arial", size: 10 }, borders: thin, wrapText: true, verticalAlignment: "top" };
sources.getRange("A:A").format.columnWidth = 24;
sources.getRange("B:B").format.columnWidth = 26;
sources.getRange("C:C").format.columnWidth = 48;
sources.getRange("D:D").format.columnWidth = 54;
sources.getRange("5:7").format.rowHeight = 42;
sources.getRange("A10:D13").merge();
sources.getRange("A10").values = [["Limit: This is a pilot unit-economics tool, not legal, tax, accounting, wage-and-hour, or insurance advice. Before launch, replace assumptions with actual worker compensation, insurance, payment-processing, customer-acquisition, support, and refund data."]];
sources.getRange("A10:D13").format = { fill: "#F3F6F8", font: { name: "Arial", size: 10, color: gray }, wrapText: true, verticalAlignment: "top", borders: thin };
sources.tabColor = "#808080";

const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(`${outputDir}/kitchen-reset-pricing-payout-model.xlsx`);

// Required compact verification before final handoff.
const inspect = await wb.inspect({ kind: "table", range: "Pricing Model!A5:K23", include: "values,formulas", tableMaxRows: 24, tableMaxCols: 11 });
console.log(inspect.ndjson);
const errors = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" });
console.log(errors.ndjson);
const preview = await wb.render({ sheetName: "Pricing Model", range: "A1:K29", scale: 1.5, format: "png" });
await fs.writeFile(`${outputDir}/pricing-model-preview.png`, new Uint8Array(await preview.arrayBuffer()));
