"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import type { CartItem } from "@/lib/utils/types";
import { CartDrawer } from "./CartDrawer";

interface CartContextType {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (variationId: string) => void;
  updateQuantity: (variationId: string, quantity: number) => void;
  clearCart: () => void;
  isOpen: boolean;
  toggleCart: () => void;
  setCartOpen: (open: boolean) => void;
  total: number;
  totalItems: number;
  totalFormatted: string;
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

  const addItem = useCallback((item: CartItem) => {
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
    setIsOpen(true);
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
      }}
    >
      {children}
      <CartDrawer />
    </CartContext.Provider>
  );
}
