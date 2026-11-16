"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importSeed = importSeed;
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const FLAT_COLLECTIONS = {
    orders: 'api::order.order',
    contactMessages: 'api::contact-message.contact-message',
    newsletterSubscribers: 'api::newsletter-subscriber.newsletter-subscriber',
    protocols: 'api::protocol.protocol',
};
async function importSeed(strapi) {
    if (process.env.SEED_DISABLED === 'true')
        return;
    const seedDir = path_1.default.join(strapi.dirs.app.root, 'seed');
    const dataPath = path_1.default.join(seedDir, 'data.json');
    if (!fs_1.default.existsSync(dataPath))
        return;
    const data = JSON.parse(fs_1.default.readFileSync(dataPath, 'utf8'));
    await importCatalog(strapi, data, seedDir);
    await importFlatCollections(strapi, data);
}
async function importCatalog(strapi, data, seedDir) {
    var _a, _b;
    const [categoryCount, productCount] = await Promise.all([
        strapi.documents('api::category.category').count({}),
        strapi.documents('api::product.product').count({}),
    ]);
    if (categoryCount > 0 || productCount > 0)
        return;
    strapi.log.info(`[seed] Base vide : import de ${data.files.length} images, ${data.categories.length} catégories, ${data.products.length} produits…`);
    // 1) Images -> médiathèque (formats/miniatures régénérés par le plugin upload)
    const mediaIdByKey = {};
    const uploadService = strapi.plugin('upload').service('upload');
    const tmpDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'strapi-seed-'));
    try {
        for (const file of data.files) {
            const src = path_1.default.join(seedDir, 'uploads', file.file);
            if (!fs_1.default.existsSync(src)) {
                strapi.log.warn(`[seed] Image manquante, ignorée : ${file.file}`);
                continue;
            }
            // copie temporaire : le plugin upload ne doit pas toucher au seed
            const tmp = path_1.default.join(tmpDir, file.file);
            fs_1.default.copyFileSync(src, tmp);
            const [uploaded] = await uploadService.upload({
                data: {
                    fileInfo: {
                        name: file.name,
                        alternativeText: (_a = file.alternativeText) !== null && _a !== void 0 ? _a : undefined,
                        caption: (_b = file.caption) !== null && _b !== void 0 ? _b : undefined,
                    },
                },
                files: {
                    filepath: tmp,
                    originalFilename: file.name,
                    mimetype: file.mime,
                    size: fs_1.default.statSync(tmp).size,
                },
            });
            mediaIdByKey[file.key] = uploaded.id;
        }
    }
    finally {
        fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
    }
    const resolveMedia = (value) => {
        var _a;
        if (Array.isArray(value))
            return value.map(resolveMedia);
        if (value && typeof value === 'object') {
            if ('__media' in value)
                return (_a = mediaIdByKey[value.__media]) !== null && _a !== void 0 ? _a : null;
            return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveMedia(v)]));
        }
        return value;
    };
    // 2) Catégories, puis rattachement des parents
    const categoryIdBySlug = {};
    for (const { parent, ...category } of data.categories) {
        const created = await strapi.documents('api::category.category').create({ data: category });
        categoryIdBySlug[category.slug] = created.documentId;
    }
    for (const { slug, parent } of data.categories) {
        if (parent && categoryIdBySlug[parent]) {
            await strapi.documents('api::category.category').update({
                documentId: categoryIdBySlug[slug],
                data: { parent: categoryIdBySlug[parent] },
            });
        }
    }
    // 3) Produits
    for (const { category, ...product } of data.products) {
        const categoryId = category ? categoryIdBySlug[category] : undefined;
        await strapi.documents('api::product.product').create({
            data: { ...resolveMedia(product), ...(categoryId ? { category: categoryId } : {}) },
        });
    }
    strapi.log.info('[seed] Catalogue importé.');
}
async function importFlatCollections(strapi, data) {
    for (const [key, uid] of Object.entries(FLAT_COLLECTIONS)) {
        const rows = data[key];
        if (!(rows === null || rows === void 0 ? void 0 : rows.length))
            continue;
        if ((await strapi.documents(uid).count({})) > 0)
            continue;
        for (const { createdAt, ...row } of rows) {
            const created = await strapi.documents(uid).create({ data: row });
            // conserve la date d'origine (commandes, messages…)
            if (createdAt) {
                await strapi.db.query(uid).update({ where: { id: created.id }, data: { createdAt } });
            }
        }
        strapi.log.info(`[seed] ${rows.length} entrée(s) importée(s) dans ${uid}.`);
    }
}
