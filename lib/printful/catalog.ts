import { printfulRequest } from "./client";

interface PrintfulSizeGuide {
  type: string;
  unit: string;
  description: string;
  image_url?: string;
  image_url_front?: string;
  image_url_side?: string;
  image_url_back?: string;
  measurements: {
    type_label: string;
    values: { size: string; value?: string; min_value?: string; max_value?: string }[];
  }[];
}

export async function getSizeGuide(
  catalogProductId: number
): Promise<PrintfulSizeGuide | null> {
  try {
    const res = await printfulRequest<{ data: PrintfulSizeGuide[] }>(
      `/catalog-products/${catalogProductId}/sizes`
    );
    return res.data?.[0] || null;
  } catch (error) {
    console.error(`Failed to fetch size guide for product ${catalogProductId}:`, error);
    return null;
  }
}

export async function getProductAvailability(
  catalogProductId: number
): Promise<Record<string, boolean>> {
  try {
    const res = await printfulRequest<{ data: any[] }>(
      `/catalog-products/${catalogProductId}/availability`
    );

    const availability: Record<string, boolean> = {};
    for (const region of res.data || []) {
      for (const variant of region.variants || []) {
        availability[variant.id] = variant.availability_status === "available";
      }
    }
    return availability;
  } catch (error) {
    console.error(`Failed to fetch availability for product ${catalogProductId}:`, error);
    return {};
  }
}
