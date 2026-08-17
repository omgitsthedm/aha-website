"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import dynamic from "next/dynamic";
import type { CartItem, Product } from "@/lib/utils/types";
import { isLegacyCatalogPublic } from "@/lib/commerce/catalog-policy";
// Only shown on open/add — keep them out of the initial bundle on every page.
const CartDrawer = dynamic(() => import("./CartDrawer").then((m) => m.CartDrawer), { ssr: false });
const AddToCartModal = dynamic(() => import("./AddToCartModal").then((m) => m.AddToCartModal), { ssr: false });

interface CartContextType {
  items: CartItem[];
  /** True once browser storage has been read, even when the saved bag is empty. */
  hydrated: boolean;
  addItem: (item: CartItem, relatedProducts?: Product[], opts?: { silent?: boolean }) => void;
  removeItem: (variationId: string) => void;
  updateQuantity: (variationId: string, quantity: number) => void;
  clearCart: () => void;
  isOpen: boolean;
  toggleCart: () => void;
  setCartOpen: (open: boolean) => void;
  total: number;
  totalItems: number;
  totalFormatted: string;
  // Modal state
  isModalOpen: boolean;
  lastAddedItem: CartItem | null;
  modalRelated: Product[];
  closeModal: () => void;
  openCartFromModal: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Modal state for add-to-cart confirmation
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<CartItem | null>(null);
  const [modalRelated, setModalRelated] = useState<Product[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      // A saved browser bag is not a catalog source of truth. Drop legacy
      // entries during the provider cutover so it cannot surface dead PDP links
      // or encourage a checkout that the server will reject.
      if (!isLegacyCatalogPublic()) {
        localStorage.removeItem("aha-cart");
        return;
      }
      const saved = localStorage.getItem("aha-cart");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate shape: keep only well-formed items so schema drift or tampering
        // can never render a $NaN total. Drop anything without a finite numeric
        // price/quantity and a variation id.
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(
            (i) =>
              i && typeof i.variationId === "string" &&
              Number.isFinite(i.price) && Number.isFinite(i.quantity) && i.quantity > 0
          );
          if (clean.length) setItems(clean);
        }
      }
    } catch (err) {
      console.warn("Failed to restore cart from localStorage:", err);
      try { localStorage.removeItem("aha-cart"); } catch { /* storage may be unavailable */ }
    } finally {
      setHydrated(true);
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem("aha-cart", JSON.stringify(items));
      } catch (err) {
        console.warn("Failed to save cart to localStorage:", err);
      }
    }
  }, [items, hydrated]);

  const MAX_QUANTITY_PER_ITEM = 20;

  const addItem = useCallback((item: CartItem, relatedProducts?: Product[], opts?: { silent?: boolean }) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variationId === item.variationId);
      if (existing) {
        return prev.map((i) =>
          i.variationId === item.variationId
            ? { ...i, quantity: Math.min(i.quantity + item.quantity, MAX_QUANTITY_PER_ITEM) }
            : i
        );
      }
      return [...prev, { ...item, quantity: Math.min(item.quantity, MAX_QUANTITY_PER_ITEM) }];
    });
    // Buy-it-now (silent) skips the confirmation modal so the shopper goes
    // straight to checkout with no wall. Normal add shows the cross-sell modal.
    if (opts?.silent) return;
    setLastAddedItem(item);
    setModalRelated(relatedProducts || []);
    setIsModalOpen(true);
  }, []);

  const removeItem = useCallback((variationId: string) => {
    setItems((prev) => prev.filter((i) => i.variationId !== variationId));
  }, []);

  const updateQuantity = useCallback(
    (variationId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(variationId);
        return;
      }
      const capped = Math.min(quantity, MAX_QUANTITY_PER_ITEM);
      setItems((prev) =>
        prev.map((i) =>
          i.variationId === variationId ? { ...i, quantity: capped } : i
        )
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => setItems([]), []);
  const toggleCart = useCallback(() => setIsOpen((prev) => !prev), []);
  const setCartOpen = useCallback((open: boolean) => setIsOpen(open), []);

  // Modal controls
  const closeModal = useCallback(() => setIsModalOpen(false), []);
  const openCartFromModal = useCallback(() => {
    setIsModalOpen(false);
    setIsOpen(true);
  }, []);

  // Memoized so useCart() consumers (including the site-wide navigation) don't re-render on
  // every unrelated provider state change. Callbacks are already useCallback-stable.
  const value = useMemo(() => {
    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const totalFormatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(total / 100);
    return {
      items,
      hydrated,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      isOpen,
      toggleCart,
      setCartOpen,
      total,
      totalItems,
      totalFormatted,
      isModalOpen,
      lastAddedItem,
      modalRelated,
      closeModal,
      openCartFromModal,
    };
  }, [
    items, hydrated, addItem, removeItem, updateQuantity, clearCart, isOpen, toggleCart,
    setCartOpen, isModalOpen, lastAddedItem, modalRelated, closeModal, openCartFromModal,
  ]);

  return (
    <CartContext.Provider
      value={value}
    >
      {children}
      <CartDrawer />
      <AddToCartModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onViewBag={openCartFromModal}
        addedItem={lastAddedItem}
        relatedProducts={modalRelated}
      />
    </CartContext.Provider>
  );
}
