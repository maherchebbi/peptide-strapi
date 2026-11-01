"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const seed_shop_json_1 = __importDefault(require("./data/seed-shop.json"));
exports.default = {
    /**
     * An asynchronous register function that runs before
     * your application is initialized.
     *
     * This gives you an opportunity to extend code.
     */
    register( /* { strapi }: { strapi: Core.Strapi } */) { },
    /**
     * An asynchronous bootstrap function that runs before
     * your application gets started.
     *
     * This gives you an opportunity to set up your data model,
     * run jobs, or perform some special logic.
     */
    async bootstrap({ strapi }) {
        await ensurePublicCatalogReadAccess(strapi);
        await seedShopIfEmpty(strapi);
    },
};
/**
 * Le catalogue (Category/Product) doit être lisible publiquement (voir
 * config/middlewares.ts + app/lib/shop.ts côté Next) : ce sont des permissions
 * stockées en base par le plugin users-permissions, donc absentes d'un clone
 * avec une base vierge tant qu'on ne les recrée pas ici. Idempotent : ne crée
 * que les permissions manquantes, ne touche à rien d'autre sur le rôle Public.
 */
async function ensurePublicCatalogReadAccess(strapi) {
    const publicRole = await strapi.db
        .query('plugin::users-permissions.role')
        .findOne({ where: { type: 'public' } });
    if (!publicRole)
        return;
    const actions = [
        'api::category.category.find',
        'api::category.category.findOne',
        'api::product.product.find',
        'api::product.product.findOne',
    ];
    for (const action of actions) {
        const existing = await strapi.db
            .query('plugin::users-permissions.permission')
            .findOne({ where: { action, role: publicRole.id } });
        if (!existing) {
            await strapi.db
                .query('plugin::users-permissions.permission')
                .create({ data: { action, role: publicRole.id } });
            strapi.log.info(`[bootstrap] Permission publique activée : ${action}`);
        }
    }
}
/**
 * Catalogue de démonstration (catégories + produits) : importé une seule
 * fois, uniquement si la base ne contient encore aucune catégorie. Permet à
 * quiconque clone le projet d'avoir un catalogue fonctionnel dès le premier
 * `strapi develop`, sans script manuel à lancer. N'écrase jamais rien si des
 * catégories existent déjà (idempotent, ne tourne qu'une fois par base vide).
 */
async function seedShopIfEmpty(strapi) {
    const categoryCount = await strapi.documents('api::category.category').count({});
    if (categoryCount > 0)
        return;
    strapi.log.info(`[seed] Catalogue vide : import de ${seed_shop_json_1.default.categories.length} catégories et ${seed_shop_json_1.default.products.length} produits…`);
    const categoryIdBySlug = {};
    for (const category of seed_shop_json_1.default.categories) {
        const created = await strapi.documents('api::category.category').create({ data: category });
        categoryIdBySlug[category.slug] = created.documentId;
    }
    for (const { category, ...data } of seed_shop_json_1.default.products) {
        const categoryId = category ? categoryIdBySlug[category] : undefined;
        await strapi.documents('api::product.product').create({
            data: { ...data, ...(categoryId ? { category: categoryId } : {}) },
        });
    }
    strapi.log.info('[seed] Catalogue importé.');
}
