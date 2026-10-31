'use strict';
/**
 * Import des donnees documentaires dans Strapi 5 (Document Service).
 *
 *   node scripts/import-products.js                # SIMULATION (rien n'est ecrit)
 *   node scripts/import-products.js --apply        # ecrit reellement
 *
 * Options :
 *   --only slug1,slug2     limiter a certains produits (slugs Strapi)
 *   --overwrite            remplacer aussi les champs de contenu deja renseignes
 *   --seed chemin.json     fichier {categories, products} pour CREER les produits manquants
 *   --data chemin.json     JSON normalise (defaut : scripts/data/products_normalized.json)
 *   --report chemin.json   rapport (defaut : scripts/data/import_report.json)
 *
 * IMPORTANT : arreter `npm run develop` avant (SQLite ne supporte pas deux processus en ecriture).
 */
const fs = require('fs');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');
const { importProducts } = require('./lib/import-logic');

function arg(name, def = null) {
  const i = process.argv.indexOf(name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const overwrite = process.argv.includes('--overwrite');
  const onlyArg = arg('--only');
  const only = typeof onlyArg === 'string' ? onlyArg.split(',').map((s) => s.trim()).filter(Boolean) : null;
  const dataPath = path.resolve(arg('--data', path.join(__dirname, 'data', 'products_normalized.json')));
  const reportPath = path.resolve(arg('--report', path.join(__dirname, 'data', 'import_report.json')));
  const seedPath = arg('--seed');

  const payload = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const seed = typeof seedPath === 'string' ? JSON.parse(fs.readFileSync(path.resolve(seedPath), 'utf8')) : null;
  console.log(`Mode : ${apply ? 'APPLY (ecriture reelle)' : 'SIMULATION (aucune ecriture)'} | produits dans le fichier : ${payload.products.length}${overwrite ? ' | OVERWRITE' : ''}`);

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';
  let code = 0;
  try {
    const report = await importProducts(app, payload, {
      apply, overwrite, only, seed,
      log: (e) => console.log(`  ${e.status.padEnd(26)} ${e.slug}${e.fieldsWritten.length ? '  [' + e.fieldsWritten.join(', ') + ']' : ''}${e.error ? '  ERREUR: ' + e.error : ''}`),
    });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('\nCategories :', report.categories.map((c) => `${c.slug}=${c.status}`).join(' | '));
    console.log('Totaux :', JSON.stringify(report.totals));
    console.log(`Rapport : ${reportPath}`);
    if (report.totals.erreurs) code = 1;
  } catch (e) {
    console.error('Echec :', e);
    code = 1;
  } finally {
    await app.destroy();
  }
  process.exit(code);
}

main();
