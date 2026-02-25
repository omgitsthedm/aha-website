export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  priceFormatted: string;
  currency: string;
  images: string[];
  collectionIds: string[];
  collectionNames: string[];
  variations: ProductVariation[];
  categoryId?: string;
}

export interface ProductVariation {
  id: string;
  name: string;
  sku?: string;
  price: number;
  priceFormatted: string;
  ordinal: number;
}

export interface Collection {
  id: string;
  slug: string;
  name: string;
  description: string;
  accent: string;
  image?: string;
}

export interface CartItem {
  productId: string;
  variationId: string;
  name: string;
  variationName: string;
  price: number;
  priceFormatted: string;
  quantity: number;
  image: string;
}

export interface ShippingRate {
  id: string;
  name: string;
  rate: string;
  currency: string;
  minDeliveryDays: number;
  maxDeliveryDays: number;
}
