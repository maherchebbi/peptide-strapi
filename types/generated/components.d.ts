import type { Schema, Struct } from '@strapi/strapi';

export interface ProductChemistryItem extends Struct.ComponentSchema {
  collectionName: 'components_product_chemistry_items';
  info: {
    displayName: 'Chemistry item';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
    value: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ProductDosageNote extends Struct.ComponentSchema {
  collectionName: 'components_product_dosage_notes';
  info: {
    description: 'Section annexe du protocole (ex. Logique de titration, Signes a surveiller)';
    displayName: 'Dosage note';
  };
  attributes: {
    text: Schema.Attribute.Text & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ProductDosageReference extends Struct.ComponentSchema {
  collectionName: 'components_product_dosage_references';
  info: {
    description: 'Dosage de reference documentaire (source), jamais une recommandation medicale';
    displayName: 'Dosage reference';
  };
  attributes: {
    description: Schema.Attribute.String;
    level: Schema.Attribute.String & Schema.Attribute.Required;
    position: Schema.Attribute.Integer;
    unit: Schema.Attribute.String;
    valueMax: Schema.Attribute.Decimal;
    valueMin: Schema.Attribute.Decimal;
    valueText: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ProductDosageSection extends Struct.ComponentSchema {
  collectionName: 'components_product_dosage_sections';
  info: {
    description: 'Dosages & protocole : section documentaire complete issue de la source (non medicale)';
    displayName: 'Dosage section';
  };
  attributes: {
    applicationText: Schema.Attribute.Text;
    cycleLabel: Schema.Attribute.String;
    cycleWeeks: Schema.Attribute.Decimal;
    disclaimer: Schema.Attribute.Text;
    extraStats: Schema.Attribute.Component<'product.fact', true>;
    halfLife: Schema.Attribute.Text;
    notes: Schema.Attribute.Component<'product.point', true>;
    pauseWeeks: Schema.Attribute.Decimal;
    reconstitution: Schema.Attribute.Component<'product.reconstitution', false>;
    referenceDosages: Schema.Attribute.Component<
      'product.dosage-reference',
      true
    >;
    relatedSections: Schema.Attribute.Component<'product.dosage-note', true>;
    sourceContent: Schema.Attribute.Text;
    sourceUrl: Schema.Attribute.String;
    timing: Schema.Attribute.Text;
    titrationPhases: Schema.Attribute.Component<
      'product.titration-phase',
      true
    >;
  };
}

export interface ProductFact extends Struct.ComponentSchema {
  collectionName: 'components_product_facts';
  info: {
    displayName: 'Fact';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
    note: Schema.Attribute.String;
    value: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ProductHighlight extends Struct.ComponentSchema {
  collectionName: 'components_product_highlights';
  info: {
    displayName: 'Highlight';
  };
  attributes: {
    text: Schema.Attribute.Text & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ProductHistoryItem extends Struct.ComponentSchema {
  collectionName: 'components_product_history_items';
  info: {
    displayName: 'History item';
  };
  attributes: {
    text: Schema.Attribute.Text & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
    year: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ProductPoint extends Struct.ComponentSchema {
  collectionName: 'components_product_points';
  info: {
    displayName: 'Point';
  };
  attributes: {
    text: Schema.Attribute.Text & Schema.Attribute.Required;
  };
}

export interface ProductReconstitution extends Struct.ComponentSchema {
  collectionName: 'components_product_reconstitutions';
  info: {
    description: 'Reconstitution documentaire : fiole + diluant = concentration (texte original conserve)';
    displayName: 'Reconstitution';
  };
  attributes: {
    calculatorHref: Schema.Attribute.String;
    calculatorLabel: Schema.Attribute.String;
    diluentAmountText: Schema.Attribute.String;
    diluentLabel: Schema.Attribute.String;
    originalText: Schema.Attribute.Text;
    resultText: Schema.Attribute.String;
    resultUnit: Schema.Attribute.String;
    resultValue: Schema.Attribute.Decimal;
    vialAmountText: Schema.Attribute.String;
    vialLabel: Schema.Attribute.String;
  };
}

export interface ProductReference extends Struct.ComponentSchema {
  collectionName: 'components_product_references';
  info: {
    displayName: 'Reference';
  };
  attributes: {
    href: Schema.Attribute.String & Schema.Attribute.Required;
    label: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ProductRichSection extends Struct.ComponentSchema {
  collectionName: 'components_product_rich_sections';
  info: {
    description: 'Section editoriale de la source sans champ dedie (texte brut, listes en lignes \u00AB - \u00BB)';
    displayName: 'Rich section';
  };
  attributes: {
    level: Schema.Attribute.Integer;
    position: Schema.Attribute.Integer;
    text: Schema.Attribute.Text & Schema.Attribute.Required;
    title: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

export interface ProductSourceInfo extends Struct.ComponentSchema {
  collectionName: 'components_product_source_infos';
  info: {
    description: 'Tracabilite de la source : URL, date, categories/statuts affiches, mentions de droits';
    displayName: 'Source info';
  };
  attributes: {
    bestsellerCandidate: Schema.Attribute.Boolean &
      Schema.Attribute.DefaultTo<false>;
    editorialCategory: Schema.Attribute.String;
    keyFigures: Schema.Attribute.Component<'product.fact', true>;
    rightsNote: Schema.Attribute.Text;
    scrapedAt: Schema.Attribute.DateTime;
    shopCategory: Schema.Attribute.String;
    sourceBadge: Schema.Attribute.String;
    sourceDisclaimer: Schema.Attribute.Text;
    sourceName: Schema.Attribute.String;
    sourceSku: Schema.Attribute.String;
    sourceSlug: Schema.Attribute.String;
    sourceStage: Schema.Attribute.String;
    sourceUrl: Schema.Attribute.String;
    supplierVariants: Schema.Attribute.Component<
      'product.supplier-variant',
      true
    >;
  };
}

export interface ProductStorageItem extends Struct.ComponentSchema {
  collectionName: 'components_product_storage_items';
  info: {
    displayName: 'Storage item';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
    text: Schema.Attribute.Text & Schema.Attribute.Required;
  };
}

export interface ProductSupplierVariant extends Struct.ComponentSchema {
  collectionName: 'components_product_supplier_variants';
  info: {
    description: 'Variante de la boutique SOURCE (reference uniquement, distincte de vos variantes)';
    displayName: 'Supplier variant';
  };
  attributes: {
    bestseller: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    currency: Schema.Attribute.String;
    imageUrl: Schema.Attribute.String;
    kind: Schema.Attribute.String;
    label: Schema.Attribute.String;
    price: Schema.Attribute.Decimal;
    sizeText: Schema.Attribute.String;
    sku: Schema.Attribute.String & Schema.Attribute.Required;
    unit: Schema.Attribute.String;
  };
}

export interface ProductTimelineItem extends Struct.ComponentSchema {
  collectionName: 'components_product_timeline_items';
  info: {
    description: 'Evolution dans le temps (periode + description)';
    displayName: 'Timeline item';
  };
  attributes: {
    number: Schema.Attribute.String;
    period: Schema.Attribute.String & Schema.Attribute.Required;
    text: Schema.Attribute.Text & Schema.Attribute.Required;
  };
}

export interface ProductTitrationPhase extends Struct.ComponentSchema {
  collectionName: 'components_product_titration_phases';
  info: {
    description: 'Etape de titration documentaire (source) : valeurs et libelles originaux conserves';
    displayName: 'Titration phase';
  };
  attributes: {
    description: Schema.Attribute.Text;
    durationLabel: Schema.Attribute.String;
    durationWeeks: Schema.Attribute.Decimal;
    openEnded: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    periodEnd: Schema.Attribute.Decimal;
    periodLabel: Schema.Attribute.String;
    periodStart: Schema.Attribute.Decimal;
    periodUnit: Schema.Attribute.Enumeration<['semaine', 'mois', 'jour']>;
    position: Schema.Attribute.Integer;
    step: Schema.Attribute.Integer & Schema.Attribute.Required;
    unit: Schema.Attribute.String;
    valueMax: Schema.Attribute.Decimal;
    valueMin: Schema.Attribute.Decimal;
    valueText: Schema.Attribute.String;
  };
}

export interface ProductVariant extends Struct.ComponentSchema {
  collectionName: 'components_product_variants';
  info: {
    displayName: 'Variant';
  };
  attributes: {
    label: Schema.Attribute.String & Schema.Attribute.Required;
    price: Schema.Attribute.Decimal & Schema.Attribute.Required;
  };
}

export interface SharedAddress extends Struct.ComponentSchema {
  collectionName: 'components_shared_addresses';
  info: {
    displayName: 'Address';
    icon: 'map-pin';
  };
  attributes: {
    city: Schema.Attribute.String & Schema.Attribute.Required;
    country: Schema.Attribute.String &
      Schema.Attribute.Required &
      Schema.Attribute.DefaultTo<'FR'>;
    line1: Schema.Attribute.String & Schema.Attribute.Required;
    line2: Schema.Attribute.String;
    phone: Schema.Attribute.String;
    postalCode: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'product.chemistry-item': ProductChemistryItem;
      'product.dosage-note': ProductDosageNote;
      'product.dosage-reference': ProductDosageReference;
      'product.dosage-section': ProductDosageSection;
      'product.fact': ProductFact;
      'product.highlight': ProductHighlight;
      'product.history-item': ProductHistoryItem;
      'product.point': ProductPoint;
      'product.reconstitution': ProductReconstitution;
      'product.reference': ProductReference;
      'product.rich-section': ProductRichSection;
      'product.source-info': ProductSourceInfo;
      'product.storage-item': ProductStorageItem;
      'product.supplier-variant': ProductSupplierVariant;
      'product.timeline-item': ProductTimelineItem;
      'product.titration-phase': ProductTitrationPhase;
      'product.variant': ProductVariant;
      'shared.address': SharedAddress;
    }
  }
}
