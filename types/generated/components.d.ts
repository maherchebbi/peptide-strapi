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
      'product.fact': ProductFact;
      'product.highlight': ProductHighlight;
      'product.history-item': ProductHistoryItem;
      'product.point': ProductPoint;
      'product.reference': ProductReference;
      'product.storage-item': ProductStorageItem;
      'product.variant': ProductVariant;
      'shared.address': SharedAddress;
    }
  }
}
