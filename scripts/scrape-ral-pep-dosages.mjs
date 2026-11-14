/**
 * scrape-ral-pep-dosages.mjs  (v3 – parsing HTML structurel)
 * Usage :
 *   node scripts/scrape-ral-pep-dosages.mjs retatrutide bpc-157
 */

import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

const BASE = "https://ral-pep.com";
const OUT_DIR = path.resolve("scripts/output");
const OUT_FILE = path.join(OUT_DIR, "dosages-ral-pep.json");

const DEFAULT_SLUGS = [
  "retatrutide",
  "bioglutide",
  "brenipatide",
  "semaglutide",
  "tirzepatide",
  "cagrilintide",
  "bpc-157",
  "tb-500",
  "bpc157-tb500",
  "cjc-1295",
  "ipamorelin",
  "cjc1295-ipamorelin",
  "tesamorelin",
  "epitalon",
  "ghk-cu",
  "mots-c",
  "nad-plus",
  "pt-141",
  "selank",
  "semax",
  "dsip",
  "mt-2",
  "mt-1",
  "igf-1lr3-0-1mg",
  "kpv",
];

const SLUG_MAP = {
  retatrutide: "retatrutide",
  bioglutide: "bioglutide",
  brenipatide: "brenipatide-ly-3537031",
  semaglutide: "semaglutide",
  tirzepatide: "tirzepatide",
  "bpc-157": "bpc-157",
  "tb-500": "tb-500",
  tesamorelin: "tesamorelin",
  epitalon: "epitalon",
  "ghk-cu": "ghk-cu",
  "mots-c": "mots-c",
  "nad-plus": "nad-plus",
  "pt-141": "pt-141",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clean(text) {
  return (text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&#39;/g, "'")
    .trim();
}

function parseDoseValue(raw) {
  if (!raw) return null;
  const t = clean(raw).replace(",", ".");

  let m = t.match(
    /(\d+(?:\.\d+)?)\s*[–\-]\s*(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug)/i
  );
  if (m) {
    const unit =
      /mcg|µg|ug/i.test(m[3]) ? "mcg" : "mg";
    return {
      valueText: `${m[1]}–${m[2]} ${unit}`,
      valueMin: Number(m[1]),
      valueMax: Number(m[2]),
      unit,
    };
  }

  m = t.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug)/i);
  if (m) {
    const unit = /mcg|µg|ug/i.test(m[2]) ? "mcg" : "mg";
    const n = Number(m[1]);
    return {
      valueText: `${n} ${unit}`,
      valueMin: n,
      valueMax: n,
      unit,
    };
  }
  return null;
}

function parsePeriod(label) {
  const t = clean(label).toLowerCase();
  const open = t.includes("+") || t.includes("suivantes");

  let m = t.match(/semaine\s*(\d+)\s*$/i);
  if (m) {
    const n = Number(m[1]);
    return { periodStart: n, periodEnd: n, openEnded: open, periodUnit: "semaine" };
  }

  m = t.match(/semaines?\s*(\d+)\s*[–\-]\s*(\d+)/i);
  if (m) {
    return {
      periodStart: Number(m[1]),
      periodEnd: Number(m[2]),
      openEnded: open,
      periodUnit: "semaine",
    };
  }
  return { periodUnit: "semaine", openEnded: open };
}

function extractDosage(html, sourceUrl) {
  const $ = cheerio.load(html);

  // ---------- 1. Dosages de référence ----------
  const referenceDosages = [];
  const levelNames = new Set(["Débutant", "Usage courant", "Élevé"]);

  // Chaque carte de dosage est un div flex avec niveau + description + dose
  $("h3").each((_, h3) => {
    const title = clean($(h3).text());
    if (!/dosages de référence/i.test(title)) return;

    // Conteneur suivant (dl ou div)
    const container = $(h3).next();
    container.find("div.flex, div").each((__, card) => {
      const texts = $(card)
        .find("div, span")
        .map((___, el) => clean($(el).text()))
        .get()
        .filter(Boolean);

      // Cherche un niveau connu dans les textes du card
      const level = texts.find((t) => levelNames.has(t));
      if (!level) return;
      if (referenceDosages.some((r) => r.level === level)) return;

      const doseText = texts.find((t) => parseDoseValue(t));
      const dose = parseDoseValue(doseText);
      if (!dose) return;

      const description = texts.find(
        (t) => t !== level && t !== doseText && t.length > 3 && t.length < 80
      );

      referenceDosages.push({
        level,
        description: description || undefined,
        valueText: dose.valueText,
        valueMin: dose.valueMin,
        valueMax: dose.valueMax,
        unit: dose.unit,
        position: referenceDosages.length + 1,
      });
    });
  });

  // Fallback texte brut si 0 ref
  if (referenceDosages.length === 0) {
    const body = $("body").text();
    for (const level of ["Débutant", "Usage courant", "Élevé"]) {
      const re = new RegExp(
        level +
          "[\\s\\S]{0,60}?(\\d+(?:[.,]\\d+)?\\s*(?:mg|mcg))",
        "i"
      );
      const m = body.match(re);
      if (m) {
        const dose = parseDoseValue(m[1]);
        if (dose && !referenceDosages.some((r) => r.level === level)) {
          referenceDosages.push({
            level,
            valueText: dose.valueText,
            valueMin: dose.valueMin,
            valueMax: dose.valueMax,
            unit: dose.unit,
            position: referenceDosages.length + 1,
          });
        }
      }
    }
  }

  // ---------- 2. Cycle / Timing / Demi-vie ----------
  let cycleLabel, cycleWeeks, timing, halfLife;
  const bodyText = $("body").text().replace(/\s+/g, " ");

  const cycleM = bodyText.match(/Cycle\s+(\d+\s*sem[^.]*)/i);
  if (cycleM) {
    cycleLabel = clean(cycleM[1]);
    const n = cycleLabel.match(/(\d+)/);
    if (n) cycleWeeks = Number(n[1]);
  }

  const timingM = bodyText.match(/Timing\s+([^.]{5,120}?)(?:\s+Demi-vie|\s+Protocole|$)/i);
  if (timingM) timing = clean(timingM[1]);

  const halfM = bodyText.match(/Demi-vie\s+([^.]{5,200}?)(?:\s+Protocole|\s+Logique|$)/i);
  if (halfM) halfLife = clean(halfM[1]);

  // ---------- 3. Reconstitution ----------
  let reconstitution;
  const reconM = bodyText.match(
    /(\d+(?:[.,]\d+)?)\s*mg\s*\+\s*(\d+(?:[.,]\d+)?)\s*ml/i
  );
  if (reconM) {
    const vialMg = Number(reconM[1].replace(",", "."));
    const bacMl = Number(reconM[2].replace(",", "."));
    const conc = +(vialMg / bacMl).toFixed(4);
    reconstitution = {
      vialAmountText: `${vialMg} mg`,
      vialLabel: "fiole",
      diluentAmountText: `${bacMl} ml`,
      diluentLabel: "eau BAC",
      resultText: `${conc} mg/ml`,
      resultValue: conc,
      resultUnit: "mg/ml",
      originalText: `${vialMg} mg + ${bacMl} ml`,
    };
  }

  // ---------- 4. Protocole de titration ----------
  const titrationPhases = [];

  $("h3").each((_, h3) => {
    const title = clean($(h3).text());
    if (!/protocole de titration/i.test(title)) return;

    const container = $(h3).next();
    // Chaque phase = un div.flex
    container.find("div.flex").each((__, row) => {
      const allText = clean($(row).text());
      // Ex: "1 Semaine 1 1 sem. 0.5 mg"
      const m = allText.match(
        /^(\d+)\s+(Semaines?\s+[\d\-–+]+)\s+(\d+\s*sem\.?)?\s*(\d+(?:[.,]\d+)?\s*(?:mg|mcg))/i
      );
      if (!m) {
        // essai plus souple
        const stepM = allText.match(/^(\d+)/);
        const periodM = allText.match(/(Semaines?\s+[\d\-–+]+)/i);
        const doseM = allText.match(/(\d+(?:[.,]\d+)?\s*(?:mg|mcg))/i);
        const durM = allText.match(/(\d+)\s*sem/i);
        if (!stepM || !periodM || !doseM) return;

        const step = Number(stepM[1]);
        const periodLabel = clean(periodM[1]);
        const dose = parseDoseValue(doseM[1]);
        if (!dose) return;
        if (titrationPhases.some((p) => p.step === step)) return;

        const period = parsePeriod(periodLabel);
        const durationWeeks = durM
          ? Number(durM[1])
          : period.periodStart != null && period.periodEnd != null
            ? period.periodEnd - period.periodStart + 1
            : undefined;

        titrationPhases.push({
          step,
          periodLabel,
          periodUnit: "semaine",
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          openEnded: Boolean(period.openEnded),
          durationLabel: durationWeeks ? `${durationWeeks} sem.` : undefined,
          durationWeeks,
          valueText: dose.valueText,
          valueMin: dose.valueMin,
          valueMax: dose.valueMax,
          unit: dose.unit,
        });
        return;
      }

      const step = Number(m[1]);
      const periodLabel = clean(m[2]);
      const dose = parseDoseValue(m[4]);
      if (!dose) return;
      if (titrationPhases.some((p) => p.step === step)) return;

      const period = parsePeriod(periodLabel);
      let durationWeeks;
      if (m[3]) {
        const dm = m[3].match(/(\d+)/);
        if (dm) durationWeeks = Number(dm[1]);
      }
      if (
        durationWeeks == null &&
        period.periodStart != null &&
        period.periodEnd != null
      ) {
        durationWeeks = period.periodEnd - period.periodStart + 1;
      }

      titrationPhases.push({
        step,
        periodLabel,
        periodUnit: "semaine",
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        openEnded: Boolean(period.openEnded),
        durationLabel: durationWeeks ? `${durationWeeks} sem.` : undefined,
        durationWeeks,
        valueText: dose.valueText,
        valueMin: dose.valueMin,
        valueMax: dose.valueMax,
        unit: dose.unit,
      });
    });
  });

  // Fallback regex sur le body si 0 phase
  if (titrationPhases.length === 0) {
    const re =
      /(\d+)\s+(Semaines?\s+[\d\-–+]+)\s+(\d+)\s*sem\.?\s+(\d+(?:[.,]\d+)?\s*(?:mg|mcg))/gi;
    let match;
    while ((match = re.exec(bodyText)) !== null) {
      const step = Number(match[1]);
      const periodLabel = clean(match[2]);
      const durationWeeks = Number(match[3]);
      const dose = parseDoseValue(match[4]);
      if (!dose) continue;
      if (titrationPhases.some((p) => p.step === step)) continue;
      const period = parsePeriod(periodLabel);
      titrationPhases.push({
        step,
        periodLabel,
        periodUnit: "semaine",
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        openEnded: Boolean(period.openEnded),
        durationLabel: `${durationWeeks} sem.`,
        durationWeeks,
        valueText: dose.valueText,
        valueMin: dose.valueMin,
        valueMax: dose.valueMax,
        unit: dose.unit,
      });
    }
  }

  const disclaimer =
    "Produit destiné à la recherche uniquement (research use only). Les valeurs affichées sont indicatives et à visée informative. Ne constitue pas un conseil médical.";

  const dosage = {
    cycleLabel,
    cycleWeeks,
    timing,
    halfLife,
    referenceDosages: referenceDosages.length ? referenceDosages : undefined,
    titrationPhases: titrationPhases.length ? titrationPhases : undefined,
    reconstitution,
    sourceUrl,
    disclaimer,
  };

  const hasContent =
    dosage.referenceDosages ||
    dosage.titrationPhases ||
    dosage.reconstitution ||
    dosage.cycleWeeks ||
    dosage.timing;

  return hasContent ? dosage : null;
}

async function fetchPage(slug) {
  const url = `${BASE}/fr/peptides/${slug}/`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return { url, html: await res.text() };
}

async function main() {
  const args = process.argv.slice(2);
  const slugs = args.length > 0 ? args : DEFAULT_SLUGS;

  await fs.mkdir(OUT_DIR, { recursive: true });
  const results = [];

  for (const slug of slugs) {
    process.stdout.write(`→ ${slug} ... `);
    try {
      const { url, html } = await fetchPage(slug);
      const dosage = extractDosage(html, url);

      if (!dosage) {
        console.log("aucun dosage structuré");
        results.push({
          sourceSlug: slug,
          targetSlug: SLUG_MAP[slug] || slug,
          sourceUrl: url,
          dosage: null,
          error: "no structured dosage",
        });
      } else {
        console.log(
          `OK (${dosage.referenceDosages?.length ?? 0} refs, ${dosage.titrationPhases?.length ?? 0} phases)`
        );
        results.push({
          sourceSlug: slug,
          targetSlug: SLUG_MAP[slug] || slug,
          sourceUrl: url,
          dosage,
        });
      }
    } catch (err) {
      console.log(`ERREUR: ${err.message}`);
      results.push({
        sourceSlug: slug,
        targetSlug: SLUG_MAP[slug] || slug,
        dosage: null,
        error: String(err.message),
      });
    }
    await sleep(1000);
  }

  await fs.writeFile(OUT_FILE, JSON.stringify(results, null, 2), "utf8");
  console.log(`\nÉcrit → ${OUT_FILE}`);
  console.log(
    `Succès : ${results.filter((r) => r.dosage).length} / ${results.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});