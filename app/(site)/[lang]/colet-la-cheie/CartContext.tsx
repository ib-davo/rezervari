"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { Product } from "@/lib/coletProducts";

const STORAGE_KEY = "davo-colet-cart-v1";

export type CartLine = {
  product: Product;
  quantity: number;
};

type CartState = {
  lines: Record<string, CartLine>;
};

type CartAction =
  | { type: "add"; product: Product; quantity?: number }
  | { type: "set"; productId: string; quantity: number }
  | { type: "remove"; productId: string }
  | { type: "clear" }
  | { type: "hydrate"; state: CartState };

function reducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "add": {
      const existing = state.lines[action.product.id];
      const nextQty = (existing?.quantity ?? 0) + (action.quantity ?? 1);
      return {
        lines: {
          ...state.lines,
          [action.product.id]: { product: action.product, quantity: nextQty },
        },
      };
    }
    case "set": {
      if (action.quantity <= 0) {
        const rest = { ...state.lines };
        delete rest[action.productId];
        return { lines: rest };
      }
      const line = state.lines[action.productId];
      if (!line) return state;
      return {
        lines: {
          ...state.lines,
          [action.productId]: { ...line, quantity: action.quantity },
        },
      };
    }
    case "remove": {
      const rest = { ...state.lines };
      delete rest[action.productId];
      return { lines: rest };
    }
    case "clear":
      return { lines: {} };
    case "hydrate":
      return action.state;
    default:
      return state;
  }
}

type CartContextValue = {
  lines: CartLine[];
  itemCount: number;
  totalMdl: number;
  add: (product: Product, quantity?: number) => void;
  set: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  hasPerishable: boolean;
  isOpen: boolean;
  setOpen: (v: boolean) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { lines: {} });
  const [isOpen, setOpen] = useState(false);
  const hydratedRef = useRef(false);

  // Hydrate from localStorage on mount + persist on every change.
  // Using a ref (not state) for "hydrated" avoids cascading renders.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CartState;
        if (parsed && typeof parsed === "object" && parsed.lines) {
          dispatch({ type: "hydrate", state: parsed });
        }
      }
    } catch {}
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  const lines = useMemo(() => Object.values(state.lines), [state.lines]);
  const itemCount = useMemo(
    () => lines.reduce((acc, l) => acc + l.quantity, 0),
    [lines]
  );
  const totalMdl = useMemo(
    () => lines.reduce((acc, l) => acc + l.product.price * l.quantity, 0),
    [lines]
  );
  const hasPerishable = useMemo(
    () => lines.some((l) => l.product.perishable),
    [lines]
  );

  const add = useCallback(
    (product: Product, quantity?: number) =>
      dispatch({ type: "add", product, quantity }),
    []
  );
  const set = useCallback(
    (productId: string, quantity: number) =>
      dispatch({ type: "set", productId, quantity }),
    []
  );
  const remove = useCallback(
    (productId: string) => dispatch({ type: "remove", productId }),
    []
  );
  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  const value: CartContextValue = {
    lines,
    itemCount,
    totalMdl,
    add,
    set,
    remove,
    clear,
    hasPerishable,
    isOpen,
    setOpen,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
