import photographs from './photography.json' with { type: 'json' };
import type { Product } from './collections';

const photography = photographs as Record<string, { style: string; setting: string; photos: Product['campaign'] }>;
/** The approved website shoot replaces editorial views only. Garment galleries stay exact. */
export const photosFor = (product: Product): Product['campaign'] => photography[product.slug]?.photos ?? product.campaign;
export const styleFor = (product: Product) => photography[product.slug]?.style ?? 'everyday';
export const photographedProduct = (product: Product): Product => ({ ...product, campaign: photosFor(product), campaignSetting: photography[product.slug]?.setting ?? product.campaignSetting } as Product);
