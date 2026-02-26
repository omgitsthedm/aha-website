"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { CartItem, Product } from "@/lib/utils/types";
import { CartDrawer } from "./CartDrawer";
import { AddToCartModal } from "./AddToCartModal";

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem, relatedProducts?: Product[]) => void;
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
  const [mounted, setMounted] = useState(false);

  // Modal state for add-to-cart confirmation
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<CartItem | null>(null);
  const [modalRelated, setModalRelated] = useState<Product[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("aha-cart");
    if (saved) {
      try {
        setItems(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (mounted) {
      localStorage.setItem("aha-cart", JSON.stringify(items));
    }
  }, [items, mounted]);

  const addItem = useCallback((item: CartItem, relatedProducts?: Product[]) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.variationId === item.variationId);
      if (existing) {
        return prev.map((i) =>
          i.variationId === item.variationId
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        );
      }
      return [...prev, item];
    });
    // Show confirmation modal instead of opening cart drawer
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
      setItems((prev) =>
        prev.map((i) =>
          i.variationId === variationId ? { ...i, quantity } : i
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

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(total / 100);

  return (
    <CartContext.Provider
      value={{
        items,
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
      }}
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
