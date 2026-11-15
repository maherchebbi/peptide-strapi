/**
 * scrape-ral-protocol-generator.mjs
 *
 * Scrape le générateur RAL Pep
 * - 3 niveaux : Débutant / Usage courant / Expérimenté
 * - gère les boutons disabled
 * - contourne les overlays (cookies / rsp-*)
 */

import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const URL = "https://ral-pep.com/fr/protocole/";
const OUTPUT_DIR = path.resolve("scripts/output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "ral-protocols.json");
const DEBUG_DIR = path.join(OUTPUT_DIR, "debug-ral");

const WAIT_AFTER_SELECTION = 1600;

const LEVELS = [
  { key: "debutant", label: "Débutant" },
  { key: "usage-courant", label: "Usage courant" },
  { key: "experimente", label: "Expérimenté" },
];

function clean(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ------------------------------------------------------------------
// NETTOYAGE OVERLAYS / COOKIES
// ------------------------------------------------------------------

async function dismissOverlays(page) {
  // Boutons classiques
  for (const name of [/accepter/i, /accept/i, /agree/i, /tout accepter/i, /ok/i]) {
    try {
      const btn = page.getByRole("button", { name });
      if (await btn.isVisible({ timeout: 800 })) {
        await btn.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(300);
      }
    } catch {
      // ignore
    }
  }

  // Suppression forcée des overlays connus
  await page.evaluate(() => {
    const selectors = [
      ".rsp-root",
      ".rsp-veil",
      ".rsp-card",
      "[class*='cookie']",
      "[id*='cookie']",
      "[class*='consent']",
      "[id*='consent']",
      ".cc-window",
      "#onetrust-banner-sdk",
    ];

    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => {
        try {
          el.remove();
        } catch {
          el.style.setProperty("display", "none", "important");
          el.style.setProperty("pointer-events", "none", "important");
        }
      });
    }

    // Au cas où un fixed overlay bloque tout
    document.querySelectorAll("div").forEach((el) => {
      const style = window.getComputedStyle(el);
      if (
        style.position === "fixed" &&
        (style.zIndex === "9999" || Number(style.zIndex) > 1000) &&
        el.offsetHeight > 100
      ) {
        const text = (el.innerText || "").toLowerCase();
        if (
          text.includes("cookie") ||
          text.includes("consent") ||
          text.includes("préférences") ||
          text.includes("accepter")
        ) {
          try {
            el.remove();
          } catch {
            el.style.setProperty("display", "none", "important");
          }
        }
      }
    });
  });

  await page.waitForTimeout(200);
}

// ------------------------------------------------------------------
// SELECTEUR PEPTIDE
// ------------------------------------------------------------------

async function findPeptideSelector(page) {
  const selects = page.locator("select");
  const count = await selects.count();
  const candidates = [];

  for (let i = 0; i < count; i++) {
    const select = selects.nth(i);
    const info = await select.evaluate((el) => ({
      options: [...el.options].map((o) => ({
        value: o.value,
        label: o.textContent.trim(),
        disabled: o.disabled,
      })),
      visible: !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    }));

    const valid = info.options.filter((o) => o.value && o.label && !o.disabled);
    if (valid.length >= 3 && info.visible) {
      candidates.push({ index: i, options: valid });
    }
  }

  if (!candidates.length) {
    throw new Error("Sélecteur de peptides introuvable.");
  }

  candidates.sort((a, b) => b.options.length - a.options.length);
  const selected = candidates[0];
  console.log(`Sélecteur trouvé : ${selected.options.length} options`);

  return {
    locator: selects.nth(selected.index),
    options: selected.options,
  };
}

// ------------------------------------------------------------------
// NIVEAUX (clic JS + gestion disabled)
// ------------------------------------------------------------------

async function getLevelState(page) {
  return await page.evaluate((labels) => {
    const result = {};
    for (const label of labels) {
      const btn = [...document.querySelectorAll("button")].find(
        (b) => b.textContent.trim() === label
      );
      if (!btn) {
        result[label] = { found: false, disabled: true, pressed: false };
        continue;
      }
      result[label] = {
        found: true,
        disabled: btn.disabled || btn.getAttribute("aria-disabled") === "true",
        pressed: btn.getAttribute("aria-pressed") === "true",
      };
    }
    return result;
  }, LEVELS.map((l) => l.label));
}

async function selectLevel(page, levelLabel) {
  // Clic via JS pour contourner les overlays
  const clicked = await page.evaluate((label) => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) => b.textContent.trim() === label
    );
    if (!btn) return { ok: false, reason: "not-found" };
    if (btn.disabled || btn.getAttribute("aria-disabled") === "true") {
      return { ok: false, reason: "disabled" };
    }
    btn.click();
    return { ok: true };
  }, levelLabel);

  if (!clicked.ok) return clicked;

  await page.waitForTimeout(900);
  return clicked;
}

// ------------------------------------------------------------------
// EXTRACTION TABLEAU
// ------------------------------------------------------------------

async function extractProtocol(page) {
  return await page.evaluate(() => {
    const clean = (value) =>
      String(value || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const tables = [...document.querySelectorAll("table")];
    let bestTable = null;
    let bestScore = 0;

    for (const table of tables) {
      const text = clean(table.innerText);
      const score =
        (/sem\.|semaine/i.test(text) ? 4 : 0) +
        (/dose/i.test(text) ? 3 : 0) +
        (/phase/i.test(text) ? 2 : 0) +
        (/volume|seringue|injection|total/i.test(text) ? 2 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestTable = table;
      }
    }

    if (!bestTable) {
      return { found: false, headers: [], rows: [], groups: [], allRows: [] };
    }

    const allRows = [...bestTable.querySelectorAll("tr")]
      .map((row, index) => {
        const cells = [...row.querySelectorAll("th, td")].map((c) =>
          clean(c.innerText)
        );
        const hasColspan = row.querySelector("[colspan]") !== null;
        const isGroup =
          hasColspan ||
          cells.length <= 1 ||
          (cells.length === 2 &&
            /adaptation|montée|maintenance|démarrage/i.test(cells[0] || ""));
        return { index, isGroup, cells, text: clean(row.innerText) };
      })
      .filter((r) => r.text);

    const headerIndex = allRows.findIndex(
      (row) =>
        /sem\.|semaine/i.test(row.text) &&
        (/dose|phase/i.test(row.text) || row.cells.length >= 4)
    );

    const headers = headerIndex >= 0 ? allRows[headerIndex].cells : [];

    const dataRows = allRows.filter(
      (row, i) => i > headerIndex && !row.isGroup && row.cells.length >= 4
    );

    const groups = [];
    let currentGroup = null;
    for (const row of allRows) {
      if (row.isGroup && row.text) {
        currentGroup = { label: row.text, rows: [] };
        groups.push(currentGroup);
      } else if (currentGroup && !row.isGroup && row.cells.length >= 4) {
        currentGroup.rows.push(row);
      }
    }

    return {
      found: true,
      headers,
      rows: dataRows,
      groups,
      allRows,
    };
  });
}

async function extractSummary(page) {
  return await page.evaluate(() => {
    const clean = (value) =>
      String(value || "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const body = clean(document.body.innerText);
    const headings = ["h1", "h2", "h3"].flatMap((sel) =>
      [...document.querySelectorAll(sel)].map((el) => clean(el.innerText))
    );

    const protocolHeading =
      headings.find((t) => /^protocole\s*[—-]/i.test(t)) || null;

    const concentration = body.match(
      /Concentration après reconstitution\s*:\s*([^.\n]+)/i
    );

    return {
      protocolHeading,
      concentration: concentration ? clean(concentration[1]) : null,
    };
  });
}

function normalizeRows(protocol) {
  const headerAliases = {
    week: /^(sem\.?|semaine|s\.?)$/i,
    phase: /^phase$/i,
    dose: /dose/i,
    injections: /^(inj\.?|injections?)$/i,
    volume: /volume/i,
    syringe: /seringue|ui|unités?/i,
    weeklyTotal: /total/i,
  };

  const positions = {};
  (protocol.headers || []).forEach((header, index) => {
    for (const [key, regex] of Object.entries(headerAliases)) {
      if (regex.test(header) && positions[key] === undefined) {
        positions[key] = index;
      }
    }
  });

  if (Object.keys(positions).length < 4) {
    positions.week = 0;
    positions.phase = 1;
    positions.dose = 2;
    positions.injections = 3;
    positions.volume = 4;
    positions.syringe = 5;
    positions.weeklyTotal = 6;
  }

  return (protocol.rows || []).map((row) => {
    const get = (key) => {
      const i = positions[key];
      return i === undefined ? null : row.cells[i] ?? null;
    };

    let week = get("week");
    if (week) week = week.replace(/^▸\s*/, "").trim();

    return {
      week,
      phase: get("phase"),
      dosePerInjection: get("dose"),
      injections: get("injections"),
      volumePerInjection: get("volume"),
      syringeUnits: get("syringe"),
      weeklyTotal: get("weeklyTotal"),
      originalCells: row.cells,
      sourceText: row.text,
    };
  });
}

async function saveDebug(page, name) {
  const safe = slugify(name) || "unknown";
  await page.screenshot({
    path: path.join(DEBUG_DIR, `${safe}.png`),
    fullPage: true,
  });
  await fs.writeFile(
    path.join(DEBUG_DIR, `${safe}.html`),
    await page.content(),
    "utf8"
  );
}

// ------------------------------------------------------------------
// SCRAPE D'UN NIVEAU
// ------------------------------------------------------------------

async function scrapeCurrentTable(page, level) {
  try {
    await page.waitForFunction(
      () => {
        const table = document.querySelector("table");
        return table && table.querySelectorAll("tbody tr").length >= 2;
      },
      { timeout: 7000 }
    );
  } catch {
    // continue
  }

  await page.waitForTimeout(300);

  const summary = await extractSummary(page);
  const protocol = await extractProtocol(page);

  if (!protocol.found || protocol.rows.length === 0) {
    return {
      label: level.label,
      key: level.key,
      success: false,
      error: "weekly_table_not_found",
      summary,
    };
  }

  const rows = normalizeRows(protocol);

  return {
    label: level.label,
    key: level.key,
    success: true,
    summary,
    headers: protocol.headers,
    rowCount: rows.length,
    rows,
    groups: protocol.groups,
  };
}

// ------------------------------------------------------------------
// SCRAPE D'UN PEPTIDE (tous les niveaux disponibles)
// ------------------------------------------------------------------

async function scrapePeptide(page, selector, option) {
  console.log(`\n→ ${option.label}`);

  await dismissOverlays(page);

  const before = await page.locator("body").innerText();
  await selector.selectOption(option.value);

  try {
    await page.waitForFunction(
      (prev) => document.body.innerText !== prev,
      before,
      { timeout: 10000 }
    );
  } catch {
    // ignore
  }

  await page.waitForTimeout(WAIT_AFTER_SELECTION);
  await dismissOverlays(page);

  const levelState = await getLevelState(page);
  const levels = {};

  // Combien de niveaux sont réellement cliquables ?
  const enabledLevels = LEVELS.filter((l) => {
    const st = levelState[l.label];
    return st?.found && !st.disabled;
  });

  // Si aucun niveau n'est cliquable → un seul protocole (défaut)
  if (enabledLevels.length === 0) {
    const result = await scrapeCurrentTable(page, LEVELS[0]);
    levels[LEVELS[0].key] = result;

    // On copie le même résultat dans les autres clés pour compatibilité UI
    // (ou on peut laisser uniquement debutant — au choix)
    for (const l of LEVELS.slice(1)) {
      levels[l.key] = {
        ...result,
        label: l.label,
        key: l.key,
        note: "same-as-default",
      };
    }

    if (result.success) {
      console.log(`   ✓ unique protocole → ${result.rowCount} lignes`);
    } else {
      console.log(`   ✗ tableau introuvable`);
      await saveDebug(page, option.label);
    }

    return {
      peptide: option.label,
      slug: slugify(option.label),
      sourceUrl: URL,
      success: result.success,
      levels,
      scrapedAt: new Date().toISOString(),
    };
  }

  // Sinon on parcourt les niveaux disponibles
  for (const level of LEVELS) {
    const st = levelState[level.label];

    if (!st?.found || st.disabled) {
      levels[level.key] = {
        label: level.label,
        key: level.key,
        success: false,
        error: "level_disabled",
        available: false,
      };
      console.log(`   – ${level.label.padEnd(14)} → non disponible`);
      continue;
    }

    const clickResult = await selectLevel(page, level.label);
    if (!clickResult.ok && clickResult.reason === "disabled") {
      levels[level.key] = {
        label: level.label,
        key: level.key,
        success: false,
        error: "level_disabled",
        available: false,
      };
      console.log(`   – ${level.label.padEnd(14)} → non disponible`);
      continue;
    }

    await dismissOverlays(page);
    const result = await scrapeCurrentTable(page, level);
    levels[level.key] = result;

    if (result.success) {
      console.log(`   ✓ ${level.label.padEnd(14)} → ${result.rowCount} lignes`);
    } else {
      console.log(`   ✗ ${level.label.padEnd(14)} → tableau introuvable`);
    }
  }

  const anySuccess = Object.values(levels).some((l) => l.success);
  if (!anySuccess) await saveDebug(page, option.label);

  return {
    peptide: option.label,
    slug: slugify(option.label),
    sourceUrl: URL,
    success: anySuccess,
    levels,
    scrapedAt: new Date().toISOString(),
  };
}

// ------------------------------------------------------------------
// MAIN
// ------------------------------------------------------------------

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(DEBUG_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    channel: "chrome",
  });

  const context = await browser.newContext({
    locale: "fr-FR",
    viewport: { width: 1440, height: 1000 },
  });

  const page = await context.newPage();
  const results = [];

  try {
    console.log("\nOuverture du générateur RAL Pep...\n");

    await page.goto(URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await dismissOverlays(page);

    const { locator, options } = await findPeptideSelector(page);
    console.log(`\n${options.length} peptides détectés.\n`);

    for (const option of options) {
      try {
        const result = await scrapePeptide(page, locator, option);
        results.push(result);
      } catch (error) {
        console.error(`  ERREUR : ${error.message}`);
        await saveDebug(page, option.label).catch(() => {});
        results.push({
          peptide: option.label,
          slug: slugify(option.label),
          sourceUrl: URL,
          success: false,
          error: error.message,
          levels: {},
        });
      }
      await sleep(400);
    }

    const output = {
      source: "RAL Pep",
      sourceUrl: URL,
      scrapedAt: new Date().toISOString(),
      levels: LEVELS.map((l) => l.key),
      statistics: {
        total: results.length,
        successful: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        totalWeeklyRows: results.reduce((sum, item) => {
          return (
            sum +
            Object.values(item.levels || {}).reduce(
              (s, lvl) => s + (lvl.success ? lvl.rowCount || 0 : 0),
              0
            )
          );
        }, 0),
      },
      protocols: results,
    };

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2), "utf8");

    console.log("\n--------------------------------");
    console.log("SCRAPING TERMINÉ");
    console.log("--------------------------------");
    console.log(`Peptides : ${output.statistics.total}`);
    console.log(`Réussis  : ${output.statistics.successful}`);
    console.log(`Échecs   : ${output.statistics.failed}`);
    console.log(`Lignes   : ${output.statistics.totalWeeklyRows}`);
    console.log(`\nFichier  : ${OUTPUT_FILE}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\nErreur générale :", err);
  process.exit(1);
});