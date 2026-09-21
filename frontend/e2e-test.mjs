import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const HOST = { email: "test@example.com", password: "TestPass123" };
const GUEST = { email: "e2e-guest@example.com", username: "e2eguest", password: "TestPass123" };

const log = (...a) => console.log("•", ...a);
const fail = (msg) => { throw new Error(msg); };

async function login(page, { email, password }) {
  await page.goto(`${BASE}/auth/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button:has-text("Log in")');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });
}

async function loginOrRegister(page, { email, username, password }) {
  // Try register; if the account exists we'll get an error and fall back to login.
  await page.goto(`${BASE}/auth/register`);
  await page.fill("#email", email);
  await page.fill("#username", username);
  await page.fill("#password", password);
  await page.click('button:has-text("Create account")');
  try {
    await page.waitForURL(`${BASE}/`, { timeout: 12000 });
    log(`registered ${email}`);
  } catch {
    log(`${email} exists, logging in`);
    await login(page, { email, password });
  }
}

async function saveProfile(page, name) {
  await page.waitForSelector('input[placeholder="e.g. Ananya Rao"]', { timeout: 15000 });
  await page.fill('input[placeholder="e.g. Ananya Rao"]', name);
  await page.click('button:has-text("Save profile")');
  // Profile form disappearing = profile was saved; works for both interview and GD
  await page.waitForSelector('input[placeholder="e.g. Ananya Rao"]', { state: "detached", timeout: 15000 });
}

function codeFromUrl(page) {
  const m = page.url().match(/\/rooms\/([A-Z0-9]{6})/);
  if (!m) fail(`no session code in url ${page.url()}`);
  return m[1];
}

// Wait until the answer box is ready (phase awaiting_answer for this client).
async function waitForAnswerable(page, timeout = 60000) {
  await page.waitForSelector('button:has-text("Send answer"):not([disabled]), textarea[placeholder*="answer"], textarea[placeholder*="point to the discussion"]', { timeout });
}

async function answer(page, text) {
  const ta = page.locator('textarea[placeholder*="answer"], textarea[placeholder*="point to the discussion"]').first();
  await ta.waitFor({ state: "visible", timeout: 60000 });
  await ta.fill(text);
  await page.click('button:has-text("Send answer")');
}

async function expectReport(page, timeout = 90000) {
  await page.waitForSelector("text=Feedback report", { timeout });
  const score = await page.locator("text=Overall / 100").first().waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  if (!score) fail("report rendered but no overall score");
  const comp = await page.locator("text=Competency scores").count();
  if (comp === 0) fail("report has no competency scores");
  log("report OK:", (await page.locator("text=/^\\d{1,3}$/").first().textContent().catch(() => "?")));
}

// ---- Test A: solo panel interview ----
async function testInterview(browser) {
  log("=== Test A: Panel Interview (solo) ===");
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && console.log("  [browser err]", m.text()));
  await login(page, HOST);
  log("logged in as host");

  // default mode is panel_interview; set questions to 3 to keep it short
  await page.fill('input[type="number"]', "3");
  await page.click('button:has-text("Create session")');
  await page.waitForURL(/\/rooms\/[A-Z0-9]{6}$/, { timeout: 20000 });
  const code = codeFromUrl(page);
  log("created interview session", code);

  await saveProfile(page, "Alice Candidate");
  await page.click('button:has-text("Start interview")');
  await page.waitForURL(/\/play$/, { timeout: 20000 });
  log("interview started");

  for (let i = 1; i <= 3; i++) {
    await waitForAnswerable(page);
    log(`answering Q${i}`);
    await answer(page, `This is my structured answer number ${i}. I would approach the problem by clarifying requirements, breaking it into steps, and validating with the interviewer as I go, drawing on my internship experience.`);
  }
  await expectReport(page);
  log("Test A PASSED");
  await ctx.close();
}

// ---- Test B: two-person group discussion ----
async function testGroupDiscussion(browser) {
  log("=== Test B: Group Discussion (2 users) ===");
  const ctxHost = await browser.newContext();
  const ctxGuest = await browser.newContext();
  const host = await ctxHost.newPage();
  const guest = await ctxGuest.newPage();
  host.on("console", (m) => m.type() === "error" && console.log("  [host err]", m.text()));
  guest.on("console", (m) => m.type() === "error" && console.log("  [guest err]", m.text()));

  await login(host, HOST);
  await loginOrRegister(guest, GUEST);
  log("both logged in");

  // Host creates a GD with 2 rounds
  await host.click('button:has-text("Group Discussion")');
  await host.fill('input[placeholder="e.g. Is remote work here to stay?"]', "Should AI tools be allowed in university exams?");
  await host.fill('input[type="number"]', "3");
  await host.click('button:has-text("Create session")');
  await host.waitForURL(/\/rooms\/[A-Z0-9]{6}$/, { timeout: 20000 });
  const code = codeFromUrl(host);
  log("created GD session", code);
  await saveProfile(host, "Alice Host");

  // Guest joins by code
  await guest.goto(`${BASE}/rooms/join`);
  await guest.fill("#code", code);
  await guest.click('button:has-text("Join session")');
  await guest.waitForURL(new RegExp(`/rooms/${code}$`), { timeout: 20000 });
  await saveProfile(guest, "Bob Guest");
  await guest.click('button:has-text("I\'m ready")');
  log("guest joined + ready");

  // Host starts once canStart
  const startBtn = host.locator('button:has-text("Start discussion")');
  await startBtn.waitFor({ state: "visible", timeout: 15000 });
  await host.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.includes("Start discussion"));
    return b && !b.disabled;
  }, { timeout: 20000 });
  await startBtn.click();
  await host.waitForURL(/\/play$/, { timeout: 20000 });
  await guest.waitForURL(/\/play$/, { timeout: 20000 });
  log("GD started, both in room");

  // 3 rounds (GD min) x 2 discussants = 6 contributions. Host then guest each round.
  for (let round = 1; round <= 3; round++) {
    await waitForAnswerable(host);
    log(`round ${round}: host speaks`);
    await answer(host, `Round ${round}: I believe there are strong arguments on both sides, and the key is drawing a line between learning tools and assessment integrity.`);

    await waitForAnswerable(guest);
    log(`round ${round}: guest speaks`);
    await answer(guest, `Round ${round}: I partly agree, but I'd add that outright bans are hard to enforce, so exam design itself needs to change.`);
  }

  await expectReport(host);
  await expectReport(guest);
  log("Test B PASSED");
  await ctxHost.close();
  await ctxGuest.close();
}

(async () => {
  const browser = await chromium.launch();
  let ok = true;
  try {
    await testInterview(browser);
  } catch (e) {
    ok = false;
    console.error("Test A FAILED:", e.message);
  }
  try {
    await testGroupDiscussion(browser);
  } catch (e) {
    ok = false;
    console.error("Test B FAILED:", e.message);
  }
  await browser.close();
  console.log(ok ? "\nALL TESTS PASSED" : "\nSOME TESTS FAILED");
  process.exit(ok ? 0 : 1);
})();
