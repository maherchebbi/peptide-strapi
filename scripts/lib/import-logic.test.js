'use strict';
// Test avec un FAUX Strapi (aucune base reelle). Lancer : node scripts/lib/import-logic.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { importProducts, computePatch, isEmpty } = require('./import-logic');

const payload = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'products_normalized.json'), 'utf8'));

function fakeStrapi(initial) {
  const db = { 'api::category.category': {}, 'api::product.product': {} };
  let n = 0;
  for (const c of payload.meta.categories) db['api::category.category'][c.slug] = { documentId: 'cat-' + c.slug, ...c };
  for (const p of initial) db['api::product.product'][p.slug] = { documentId: 'doc-' + p.slug, ...p };
  const calls = [];
  return {
    calls, db,
    documents: (uid) => ({
      findFirst: async ({ filters }) => db[uid][filters.slug] || null,
      create: async ({ data }) => { calls.push(['create', uid, data]); const d = { documentId: 'new-' + (++n), ...data }; db[uid][data.slug] = d; return d; },
      update: async ({ documentId, data }) => { calls.push(['update', uid, documentId, data]); const k = Object.keys(db[uid]).find((s) => db[uid][s].documentId === documentId); Object.assign(db[uid][k], data); return db[uid][k]; },
    }),
  };
}

(async () => {
  // 1) isEmpty
  assert(isEmpty(null) && isEmpty('') && isEmpty([]) && isEmpty({ id: 3 }) && !isEmpty([{ a: 1 }]) && !isEmpty('x'));

  // 2) computePatch : jamais de champ protege, ne remplace pas l'existant
  const r = computePatch({ intro: 'deja la', facts: [] }, { intro: 'nouveau', facts: [{ label: 'a', value: 'b' }], price: 999, name: 'X' });
  assert.deepStrictEqual(r.written, ['facts']);
  assert(!('price' in r.patch) && !('name' in r.patch) && !('intro' in r.patch));
  assert.deepStrictEqual(computePatch({ intro: 'deja' }, { intro: 'nouveau' }, { overwrite: true }).written, ['intro']);

  // 3) Simulation : aucune ecriture
  const existing = payload.products.map((p) => ({ slug: p.slug, name: 'N-' + p.slug, price: 85, featured: true, variants: [{ label: '5 mg', price: 55 }] }));
  existing[1] = { ...existing[1], intro: 'Mon introduction deja saisie', mechanism: [{ text: 'deja' }] };
  let s = fakeStrapi(existing.slice(0, 29)); // le 30e est ABSENT
  let rep = await importProducts(s, payload, { apply: false });
  assert.strictEqual(s.calls.length, 0, 'simulation : aucune ecriture');
  assert.strictEqual(rep.totals.absents_de_strapi, 1);
  assert.strictEqual(rep.totals.mis_a_jour, 29);

  // 4) Apply : mise a jour, prix/variants/featured/name intacts, contenu existant conserve
  s = fakeStrapi(existing.slice(0, 29));
  rep = await importProducts(s, payload, { apply: true });
  assert.strictEqual(rep.totals.erreurs, 0);
  for (const c of s.calls) {
    if (c[0] !== 'update') continue;
    for (const f of ['price', 'name', 'slug', 'description', 'variants', 'featured', 'short', 'image']) assert(!(f in c[3]), 'champ protege ecrit : ' + f);
  }
  const p2 = s.db['api::product.product'][payload.products[1].slug];
  assert.strictEqual(p2.intro, 'Mon introduction deja saisie');
  assert.deepStrictEqual(p2.mechanism, [{ text: 'deja' }]);
  assert.strictEqual(p2.price, 85);
  assert(p2.dosage && p2.dosage.referenceDosages.length === 3, 'dosage importe');
  assert(p2.category && p2.category.connect.length === 1, 'categorie associee');

  // 5) Idempotence : 2e passage = rien a faire
  rep = await importProducts(s, payload, { apply: true });
  assert.strictEqual(rep.totals.mis_a_jour, 0, 'pas de doublon ni reecriture');

  // 6) Creation avec seed
  s = fakeStrapi(existing.slice(0, 29));
  const last = payload.products[29];
  const seed = { products: [{ slug: last.slug, name: 'Nom seed', description: 'Desc seed', category: last.categorySlug, price: 45 }] };
  rep = await importProducts(s, payload, { apply: true, seed, only: [last.slug] });
  assert.strictEqual(rep.totals.crees, 1);
  const created = s.db['api::product.product'][last.slug];
  assert(created.name === 'Nom seed' && created.price === 45 && created.dosage, 'creation depuis le seed');

  // 7) --overwrite remplace le contenu
  s = fakeStrapi(existing.slice(0, 29));
  rep = await importProducts(s, payload, { apply: true, overwrite: true, only: [payload.products[1].slug] });
  assert.notStrictEqual(s.db['api::product.product'][payload.products[1].slug].intro, 'Mon introduction deja saisie');

  console.log('OK : 7 verifications passees (faux Strapi)');
})().catch((e) => { console.error('ECHEC', e); process.exit(1); });
