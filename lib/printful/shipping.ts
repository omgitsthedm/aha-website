import { printfulRequest } from "./client";
import type { ShippingRate } from "@/lib/utils/types";

interface ShippingRateRequest {
  recipient: {
    address1: string;
    city: string;
    state_code: string;
    country_code: string;
    zip: string;
  };
  items: {
    external_variant_id?: string;
    variant_id?: number;
    quantity: number;
  }[];
}

export async function getShippingRates(
  request: ShippingRateRequest
): Promise<ShippingRate[]> {
  try {
    const res = await printfulRequest<{ data: any[] }>("/shipping-rates", {
      method: "POST",
      body: request as unknown as Record<string, unknown>,
    });

    return (res.data || []).map((rate: any) => ({
      id: rate.id,
      name: rate.name,
      rate: rate.rate,
      currency: rate.currency,
      minDeliveryDays: rate.min_delivery_days,
      maxDeliveryDays: rate.max_delivery_days,
    }));
  } catch {
    return [];
  }
}
