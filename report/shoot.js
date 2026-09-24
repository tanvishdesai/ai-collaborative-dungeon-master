// Drives the running Abhyaas app and captures the three report screenshots:
//   6.1 dashboard, 6.2 live panel interview, 6.3 feedback report.
const { chromium } = require("playwright");
const path = require("path");

const OUT = path.join(__dirname, "imgs");
const BASE = "http://localhost:3000";
const EMAIL = "test@example.com";
const PASS = "TestPass123";
const ANSWERS = [
  "In my final-year project I built a real-time collaborative platform on Next.js and Convex. " +
    "I owned the backend data model and the reactive queries, and I focused on keeping state " +
    "consistent under concurrent edits by making all writes transactional.",
  "When I hit a hard bug I reproduce it first, then bisect: I isolate the smallest failing case, " +
    "add logging around the boundary, and form one hypothesis at a time. For a race condition I " +
    "once found, I moved the mutation server-side so the update was atomic, which fixed it at the root.",
  "I'd prioritise by impact and reversibility — ship the smallest change that de-risks the release, " +
    "communicate the trade-off early, and leave the harder refactor for a follow-up once we have data. " +
    "I try to be explicit about what I'm deliberately not doing yet.",
  "I handle pressure by narrowing scope: I confirm the one thing that must be true, verify it, and " +
    "build outward from there instead of trying to hold the whole system in my head at once.",
  "My key strength is turning an ambiguous problem into a concrete, testable plan, and I back it " +
    "with clear written communication so the team stays aligned.",
  "I'd measure success by whether the change actually moved the metric it targeted, and by how few " +
    "follow-up fixes it needed — correctness that holds up in production, not just in the demo.",
];

const log = (...a) => console.log("[shoot]", ...a);

async function shot(page, name) {
  await page.waitForTimeout(600);
  const p = path.join(OUT, name);
  await page.screenshot({ path: p, fullPage: true });
  log("saved", name);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  page.setDefaultTimeout(120000);

  // ---- login ----
  log("login");
  await page.goto(`${BASE}/auth/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASS);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.getByText("Practice that feels like the real thing").waitFor();
  log("dashboard loaded");

  // ---- 6.1 dashboard ----
  // fewer questions => faster full run, still a representative dashboard
  const qty = page.locator('input[type="number"]');
  await qty.fill("3");
  await page.waitForTimeout(400);
  await shot(page, "screenshot_dashboard.png");

  // ---- create session ----
  await page.getByRole("button", { name: /Create session/ }).click();
  await page.waitForURL(/\/rooms\/[A-Z0-9]+$/);
  log("lobby / profile setup");

  // ---- profile setup ----
  await page.getByPlaceholder("e.g. Ananya Rao").fill("Ananya Rao");
  await page
    .getByPlaceholder(/A few lines/)
    .fill(
      "Final-year CS student. Built a real-time collaborative app on Next.js + Convex; " +
        "internship in backend development. Comfortable with TypeScript, data modelling, and system design.",
    );
  await page.getByRole("button", { name: /Save profile/ }).click();
  log("profile saved");

  // ---- start interview ----
  await page.getByRole("button", { name: /Start interview/ }).click();
  await page.waitForURL(/\/rooms\/[A-Z0-9]+\/play$/);
  log("play page");

  const answerBox = page.getByPlaceholder(/Type your answer/);
  const reportHeading = page.getByText("Feedback report", { exact: false });

  // ---- answer loop; capture 6.2 mid-session, 6.3 on report ----
  let captured62 = false;
  for (let i = 0; i < ANSWERS.length; i++) {
    // wait for either the answer box (our turn) or the report
    const which = await Promise.race([
      answerBox.waitFor({ state: "visible", timeout: 120000 }).then(() => "answer"),
      reportHeading.waitFor({ state: "visible", timeout: 120000 }).then(() => "report"),
    ]).catch(() => "timeout");
    if (which === "report") break;
    if (which === "timeout") {
      log("timed out waiting for a turn at question", i + 1);
      break;
    }

    // capture the live session once we have a couple of exchanges on screen
    if (i === 1 && !captured62) {
      await shot(page, "screenshot_session.png");
      captured62 = true;
    }

    await answerBox.fill(ANSWERS[i]);
    await page.getByRole("button", { name: /Send answer/ }).click();
    log("answered question", i + 1);
    // let the phase flip to "generating" so the next waitFor is meaningful
    await page.waitForTimeout(1500);
  }

  // fallback: if we never grabbed 6.2 (e.g. very fast), grab it now
  if (!captured62) {
    await shot(page, "screenshot_session.png");
    captured62 = true;
  }

  // ---- 6.3 feedback report ----
  log("waiting for feedback report");
  await reportHeading.waitFor({ state: "visible", timeout: 180000 });
  // wait for the score card (overall /100) to render, not just the loader
  await page.getByText("Overall / 100").waitFor({ timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "screenshot_report.png");

  await browser.close();
  log("done");
})().catch((e) => {
  console.error("[shoot] FAILED:", e.message);
  process.exit(1);
});
