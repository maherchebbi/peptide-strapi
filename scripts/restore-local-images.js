/**
 * Rapatrie en local les fichiers encore référencés chez Cloudinary dans la médiathèque Strapi.
 *  1) essaie de télécharger l'image depuis son adresse Cloudinary ;
 *  2) sinon, la cherche par son nom dans un dossier local (argument facultatif).
 * Les relations (produits, doses) ne changent pas : seules les lignes de la table `files` sont mises à jour.
 *
 * Usage (Strapi ARRÊTÉ) :
 *   node scripts/restore-local-images.js                      -> télécharge ce qui existe encore
 *   node scripts/restore-local-images.js <dossier-des-images> -> complète avec tes images d'origine
 */
const Database = require("better-sqlite3");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const srcDir = process.argv[2];
if (srcDir && !fs.existsSync(srcDir)) {
  console.error(`Dossier introuvable : ${srcDir}`);
  process.exit(1);
}

const root = path.join(__dirname, "..");
const dbPath = path.join(root, ".tmp", "data.db");
const uploadsDir = path.join(root, "public", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const norm = (s) => s.normalize("NFC").toLowerCase();
const stem = (s) => norm(s.replace(/\.[^.]+$/, ""));

const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// Index des images locales (sous-dossiers compris), par nom complet puis sans extension
const byName = new Map();
const byStem = new Map();
if (srcDir) {
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (MIME[path.extname(entry.name).toLowerCase()]) {
        byName.set(norm(entry.name), full);
        if (!byStem.has(stem(entry.name))) byStem.set(stem(entry.name), full);
      }
    }
  })(srcDir);
}

async function main() {
  const db = new Database(dbPath);
  const rows = db.prepare("select id, name, url from files where url like '%cloudinary%' order by id").all();

  const ready = []; // { row, hash, ext, size }
  const missing = [];
  let downloaded = 0;
  let fromFolder = 0;

  for (const row of rows) {
    let buffer = null;
    let ext = path.extname(new URL(row.url).pathname).toLowerCase();

    // 1) Téléchargement depuis Cloudinary
    try {
      const res = await fetch(row.url);
      if (res.ok) {
        buffer = Buffer.from(await res.arrayBuffer());
        downloaded++;
      }
    } catch {
      /* réseau indisponible : on essaie le dossier local */
    }

    // 2) Image d'origine dans le dossier local
    if (!buffer && srcDir) {
      const source = byName.get(norm(row.name)) ?? byStem.get(stem(row.name));
      if (source) {
        buffer = fs.readFileSync(source);
        ext = path.extname(source).toLowerCase();
        fromFolder++;
      }
    }

    if (!buffer || !MIME[ext]) {
      missing.push(`${row.id} ${row.name}`);
      continue;
    }

    const base = stem(row.name).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "image";
    const hash = `${base}_${crypto.randomBytes(5).toString("hex")}`;
    fs.writeFileSync(path.join(uploadsDir, `${hash}${ext}`), buffer);
    ready.push({ row, hash, ext, size: Math.round((buffer.length / 1024) * 100) / 100 });
  }

  const update = db.prepare(
    "update files set url=?, provider='local', provider_metadata=NULL, hash=?, ext=?, mime=?, size=?, formats=NULL where id=?"
  );
  db.transaction(() => {
    for (const r of ready) {
      update.run(`/uploads/${r.hash}${r.ext}`, r.hash, r.ext, MIME[r.ext], r.size, r.row.id);
    }
  })();

  console.log(`Restaurés : ${ready.length} / ${rows.length} (téléchargés : ${downloaded}, depuis le dossier : ${fromFolder})`);
  if (missing.length) {
    console.log("Encore introuvables :");
    missing.forEach((m) => console.log("  -", m));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});