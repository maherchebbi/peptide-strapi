
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const inputPath = path.join(
  currentDir,
  "output",
  "ral-protocols.json"
);

const outputPath = path.resolve(
  currentDir,
  "../../peptide-next/app/data/ral-protocol-index.json"
);

const source = JSON.parse(fs.readFileSync(inputPath, "utf8"));

const protocols = source.protocols
  .filter((protocol) => protocol.success)
  .map((protocol) => ({
    peptide: protocol.peptide,
    slug: protocol.slug,
    sourceUrl: protocol.sourceUrl,
    phases: [
      ...new Set(
        (protocol.table?.rows ?? [])
          .map((row) => row.phase)
          .filter(Boolean)
      ),
    ],
    weeks: (protocol.table?.rows ?? []).map((row) => ({
      week: row.week.replace(/^▸\s*/, ""),
      phase: row.phase,
    })),
  }));

const output = {
  source: source.source,
  sourceUrl: source.sourceUrl,
  scrapedAt: source.scrapedAt,
  statistics: source.statistics,
  protocols,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log(`Export terminé : ${protocols.length} peptides`);
console.log(`Fichier créé : ${outputPath}`);
