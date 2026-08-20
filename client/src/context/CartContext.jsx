import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, clearCartToken } from '../lib/api';

const CartContext = createContext(null);

const EMPTY = { items: [], subtotal: 0, count: 0 };

export function CartProvider({ children }) {
  const [cart, setCart] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/cart');
      setCart(data);
    } catch {
      setCart(EMPTY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addItem = useCallback(
    async (productId, size, qty = 1, color = null) => {
      setLoading(true);
      try {
        const data = await api.post('/cart/items', { product_id: productId, size, color, qty });
        setCart(data);
        setOpen(true);
        return data;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateQty = useCallback(async (itemId, qty) => {
    setLoading(true);
    try {
      const data = await api.patch(`/cart/items/${itemId}`, { qty });
      setCart(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const removeItem = useCallback(async (itemId) => {
    setLoading(true);
    try {
      const data = await api.del(`/cart/items/${itemId}`);
      setCart(data);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearCart = useCallback(async () => {
    try {
      await api.del('/cart');
    } catch {
      /* ignore */
    }
    clearCartToken();
    setCart(EMPTY);
  }, []);

  const openCart = useCallback(() => setOpen(true), []);
  const closeCart = useCallback(() => setOpen(false), []);

  return (
    <CartContext.Provider
      value={{
        ...cart,
        open,
        loading,
        openCart,
        closeCart,
        addItem,
        updateQty,
        removeItem,
        clearCart,
        refresh,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
