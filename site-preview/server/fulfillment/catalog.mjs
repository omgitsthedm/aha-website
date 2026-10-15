/**
 * The only variants the automatic fulfiller may submit.  This is deliberately
 * a source-controlled allow list, generated from the two current Product.json
 * records on 2026-10-15.  Never accept a client SKU, title, or price as a
 * substitute for a Square variation id.
 */
export const AHA_FULFILLMENT_CATALOG = Object.freeze({
  KZFZMSVPRMY3MOC7I3TQ2B5O: { sku: "APQ-6208401S5A1", size: "XS", priceCents: 5200, product: "crewneck" },
  RKGX6H4FU6NBGAGHKXECXUBE: { sku: "APQ-6208401S6A1", size: "S", priceCents: 5200, product: "crewneck" },
  R5UCZCGSJMR3Z4HJDVOD3ZIK: { sku: "APQ-6208401S7A1", size: "M", priceCents: 5200, product: "crewneck" },
  "3CAFSZ345DL6VRX5CNBI6YDQ": { sku: "APQ-6208401S8A1", size: "L", priceCents: 5200, product: "crewneck" },
  "45VCO6MGNJTUGR6UZYLG7Y43": { sku: "APQ-6208401S1A1", size: "XL", priceCents: 5200, product: "crewneck" },
  UFYWTQK4GQFOQVYNINTCCL62: { sku: "APQ-6208401S2A1", size: "2XL", priceCents: 5200, product: "crewneck" },
  OPKNVVYLRSTI6OY75G67HY6E: { sku: "APQ-6208401S21A1", size: "3XL", priceCents: 5200, product: "crewneck" },
  UXOOJLWOXLDU32KXPFVBB6CU: { sku: "APQ-6208412S5A1", size: "XS", priceCents: 5500, product: "cropped_hoodie" },
  ATOF65IIPKIZWFT3QDJMON4R: { sku: "APQ-6208412S6A1", size: "S", priceCents: 5500, product: "cropped_hoodie" },
  WFAIFUKSQXCUDRHPTMAWO2UM: { sku: "APQ-6208412S7A1", size: "M", priceCents: 5500, product: "cropped_hoodie" },
  "4HDYVGQA3ZOGIPYFUCTPKPIV": { sku: "APQ-6208412S8A1", size: "L", priceCents: 5500, product: "cropped_hoodie" },
  YG2VANIT6R4SUQ3MWPZK74YI: { sku: "APQ-6208412S1A1", size: "XL", priceCents: 5500, product: "cropped_hoodie" },
  KEQN72Y22B5RL3V5NFVACNWQ: { sku: "APQ-6208412S2A1", size: "2XL", priceCents: 5500, product: "cropped_hoodie" },
});

export const AHA_PRIVATE_LABEL = "SB-3-161622";
