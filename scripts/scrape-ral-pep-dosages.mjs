/**
 * scrape-ral-pep-dosages.mjs  (v5 – corrigé pour le HTML réel de ral-pep)
 * Usage :
 *   node scripts/scrape-ral-pep-dosages.mjs
 *   node scripts/scrape-ral-pep-dosages.mjs retatrutide cagrilintide
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
  cagrilintide: "cagrilintide",
  "bpc-157": "bpc-157",
  "tb-500": "tb-500",
  "bpc157-tb500": "bpc157-tb500",
  "cjc-1295": "cjc-1295",
  ipamorelin: "ipamorelin",
  "cjc1295-ipamorelin": "cjc1295-ipamorelin",
  tesamorelin: "tesamorelin",
  epitalon: "epitalon",
  "ghk-cu": "ghk-cu",
  "mots-c": "mots-c",
  "nad-plus": "nad-plus",
  "pt-141": "pt-141",
  selank: "selank",
  semax: "semax",
  dsip: "dsip",
  "mt-2": "mt-2",
  "mt-1": "mt-1",
  "igf-1lr3-0-1mg": "igf-1lr3-0-1mg",
  kpv: "kpv",
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
    const unit = /mcg|µg|ug/i.test(m[3]) ? "mcg" : "mg";
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

/**
 * Parse une période de façon robuste
 */
function parsePeriod(label) {
  const t = clean(label).toLowerCase();
  const openEnded =
    t.includes("+") || t.includes("suivantes") || t.includes("et +");

  // "Semaine 1"
  let m = t.match(/semaine\s*(\d+)\s*$/i);
  if (m) {
    const n = Number(m[1]);
    return { periodStart: n, periodEnd: n, openEnded, periodUnit: "semaine" };
  }

  // "Semaines 5-8" ou "Semaines 5 – 8"
  m = t.match(/semaines?\s*(\d+)\s*[–\-]\s*(\d+)/i);
  if (m) {
    return {
      periodStart: Number(m[1]),
      periodEnd: Number(m[2]),
      openEnded,
      periodUnit: "semaine",
    };
  }

  // "Semaines 2-3-4" (plusieurs numéros)
  m = t.match(/semaines?\s*((?:\d+\s*[–\-]\s*)+\d+)/i);
  if (m) {
    const numbers = m[1]
      .split(/[–\-]/)
      .map((n) => Number(n.trim()))
      .filter((n) => !Number.isNaN(n));

    if (numbers.length >= 2) {
      return {
        periodStart: Math.min(...numbers),
        periodEnd: Math.max(...numbers),
        openEnded,
        periodUnit: "semaine",
      };
    }
  }

  // Fallback : premier nombre trouvé
  m = t.match(/(\d+)/);
  if (m) {
    const n = Number(m[1]);
    return { periodStart: n, periodEnd: n, openEnded, periodUnit: "semaine" };
  }

  return { periodUnit: "semaine", openEnded };
}

function extractDosage(html, sourceUrl) {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().replace(/\s+/g, " ");

  // ---------- 1. Dosages de référence ----------
  const referenceDosages = [];
  const levelNames = ["Débutant", "Usage courant", "Élevé"];

  $("h3").each((_, h3) => {
    const title = clean($(h3).text());
    if (!/dosages de référence/i.test(title)) return;

    let container = $(h3).next();
    if (!container.length) container = $(h3).parent();

    container.find("div").each((_, card) => {
      const texts = $(card)
        .find("div, span, p")
        .map((__, el) => clean($(el).text()))
        .get()
        .filter(Boolean);

      const level = texts.find((t) => levelNames.includes(t));
      if (!level) return;
      if (referenceDosages.some((r) => r.level === level)) return;

      const doseText = texts.find((t) => parseDoseValue(t));
      const dose = parseDoseValue(doseText);
      if (!dose) return;

      const description = texts.find(
        (t) =>
          t !== level &&
          t !== doseText &&
          t.length > 4 &&
          t.length < 90 &&
          !/mg|mcg/i.test(t)
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

  // Fallback référence
  if (referenceDosages.length === 0) {
    for (const level of levelNames) {
      const re = new RegExp(
        level + "[\\s\\S]{0,80}?(\\d+(?:[.,]\\d+)?\\s*(?:mg|mcg))",
        "i"
      );
      const m = bodyText.match(re);
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

  const cycleM = bodyText.match(/Cycle\s+(\d+\s*sem[^.]*)/i);
  if (cycleM) {
    cycleLabel = clean(cycleM[1]);
    const n = cycleLabel.match(/(\d+)/);
    if (n) cycleWeeks = Number(n[1]);
  }

  const timingM = bodyText.match(
    /Timing\s+([^.]{5,120}?)(?:\s+Demi-vie|\s+Protocole|$)/i
  );
  if (timingM) timing = clean(timingM[1]);

  const halfM = bodyText.match(
    /Demi-vie\s+([^.]{5,200}?)(?:\s+Protocole|\s+Logique|$)/i
  );
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

  // ---------- 4. Protocole de titration (CORRIGÉ) ----------
  const titrationPhases = [];

  $("h3").each((_, h3) => {
    const title = clean($(h3).text());
    if (!/protocole de titration/i.test(title)) return;

    // Le contenu est dans le sibling suivant (div.space-y-3)
    // et tout est concaténé dans un seul texte
    const next = $(h3).next();
    const fullText = clean(next.text() || $(h3).parent().text());

    // Regex qui fonctionne sur le texte collé :
    // 1Semaine 11 sem.0.5 mg2Semaines 2-3-43 sem.1 mg...
    const phaseRegex =
      /(\d+)(Semaines?\s+[\d\-–+]+)\s*(\d+\s*sem\.?)?\s*(\d+(?:[.,]\d+)?\s*(?:mg|mcg))/gi;

    let match;
    while ((match = phaseRegex.exec(fullText)) !== null) {
      const step = Number(match[1]);
      const periodLabel = clean(match[2]);
      const dose = parseDoseValue(match[4]);
      if (!dose) continue;
      if (titrationPhases.some((p) => p.step === step)) continue;

      const period = parsePeriod(periodLabel);

      let durationWeeks;
      if (match[3]) {
        const dm = match[3].match(/(\d+)/);
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
        periodStart: period.periodStart ?? null,
        periodEnd: period.periodEnd ?? null,
        openEnded: Boolean(period.openEnded),
        durationLabel: durationWeeks ? `${durationWeeks} sem.` : undefined,
        durationWeeks: durationWeeks ?? undefined,
        valueText: dose.valueText,
        valueMin: dose.valueMin,
        valueMax: dose.valueMax,
        unit: dose.unit,
      });
    }
  });

  // Fallback global si toujours 0 phase
  if (titrationPhases.length === 0) {
    const phaseRegex =
      /(\d+)(Semaines?\s+[\d\-–+]+)\s*(\d+\s*sem\.?)?\s*(\d+(?:[.,]\d+)?\s*(?:mg|mcg))/gi;

    let match;
    while ((match = phaseRegex.exec(bodyText)) !== null) {
      const step = Number(match[1]);
      const periodLabel = clean(match[2]);
      const dose = parseDoseValue(match[4]);
      if (!dose) continue;
      if (titrationPhases.some((p) => p.step === step)) continue;

      const period = parsePeriod(periodLabel);
      let durationWeeks;
      if (match[3]) {
        const dm = match[3].match(/(\d+)/);
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
        periodStart: period.periodStart ?? null,
        periodEnd: period.periodEnd ?? null,
        openEnded: Boolean(period.openEnded),
        durationLabel: durationWeeks ? `${durationWeeks} sem.` : undefined,
        durationWeeks: durationWeeks ?? undefined,
        valueText: dose.valueText,
        valueMin: dose.valueMin,
        valueMax: dose.valueMax,
        unit: dose.unit,
      });
    }
  }

  titrationPhases.sort((a, b) => a.step - b.step);

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

  console.log(`\nScraping ${slugs.length} peptide(s)...\n`);

  for (const slug of slugs) {
    process.stdout.write(`→ ${slug.padEnd(22)} `);
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
        const refs = dosage.referenceDosages?.length ?? 0;
        const phases = dosage.titrationPhases?.length ?? 0;
        console.log(`OK  (${refs} refs, ${phases} phases)`);
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
    await sleep(900);
  }

  await fs.writeFile(OUT_FILE, JSON.stringify(results, null, 2), "utf8");
  console.log(`\nÉcrit → ${OUT_FILE}`);
  console.log(
    `Succès : ${results.filter((r) => r.dosage).length} / ${results.length}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});