import { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { productModel } from '../model/product_model';
import { Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useHardwareBack } from '../hooks/useHardwareBack';
import './Order.css';

function Order() {
  const navigate = useNavigate();
  const products = useLiveQuery(() => productModel.getAllProducts()) || [];

  useHardwareBack(() => {
    navigate('/');
  });

  // Hydrate cart from localStorage on first mount
  const [cart, setCart] = useState(() => {
    try {
      const saved = localStorage.getItem('persistentCart');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Strip legacy images on load to clear up space immediately
        return parsed.map(({ image, ...rest }) => rest);
      }
      return [];
    } catch {
      return [];
    }
  });

  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const cartEndRef = useRef(null);

  // Auto-scroll to bottom of cart safely
  useEffect(() => {
    if (cartEndRef.current) {
      setTimeout(() => {
        cartEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [cart.length]);

  // Sync cart to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem('persistentCart', JSON.stringify(cart));
    } catch (e) {
      console.warn('Storage full, cart not saved', e);
      try {
        localStorage.removeItem('persistentCart');
      } catch (err) {}
    }
  }, [cart]);

  const categories = ['Semua', ...new Set(products.map(p => p.category || 'Uncategorized'))];
  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'Semua' || (p.category || 'Uncategorized').toLowerCase() === activeCategory.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addToCart = (product) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(item => item.id === product.id);
      const currentQty = existingItem ? existingItem.quantity : 0;

      // Guard: prevent adding beyond available stock
      if (currentQty >= product.stock) {
        toast.error(`"${product.name}" habis atau mencapai batas maksimum!`);
        return prevCart; // return unchanged cart
      }

      if (existingItem) {
        return prevCart.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      
      // Strip image before saving to state/localStorage
      const { image, ...productWithoutImage } = product;
      return [...prevCart, { ...productWithoutImage, quantity: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find(item => item.id === productId);
      if (existingItem.quantity > 1) {
        return prevCart.map(item =>
          item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        );
      }
      return prevCart.filter(item => item.id !== productId);
    });
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [cart]);

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Order tidak bisa diproses: Keranjang kosong.');
      return;
    }
    // Pass cart data to payment screen via state
    navigate('/payment', { state: { cart, cartTotal } });
  };

  return (
    <div className="order-container">
      <h1 className="header-title">Order Baru</h1>
      
      <div className="search-container" style={{ position: 'relative', marginBottom: '8px' }}>
        <input 
          id="searchInputOrder"
          type="text" 
          placeholder="Cari nama produk..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.target.blur();
          }}
          style={{ width: '100%', padding: '10px 70px 10px 20px', borderRadius: '50px', border: '1px solid #ddd', fontSize: '14px' }}
        />
        <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: '12px', alignItems: 'center' }}>
          {searchQuery.length > 0 && (
            <button 
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTimeout(() => document.getElementById('searchInputOrder')?.focus(), 0);
              }}
              style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <X size={20} strokeWidth={2} />
            </button>
          )}
          <button 
            type="button"
            onClick={() => document.getElementById('searchInputOrder')?.blur()}
            style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0, display: 'flex' }}
          >
            <Search size={20} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="category-tabs">
        {categories.map(cat => (
          <button 
            key={cat} 
            className={`tab-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredProducts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-light)' }}>
          <p>Produk tidak ditemukan.</p>
        </div>
      ) : (
      <div className="products-grid">
        {filteredProducts.map(product => {
          const isOutOfStock = product.stock <= 0;
          const cartQty = cart.find(i => i.id === product.id)?.quantity || 0;
          const isCartCapped = cartQty >= product.stock;
          const isDisabled = isOutOfStock || isCartCapped;
          return (
            <div 
              key={product.id} 
              className={`product-card ${isOutOfStock ? 'out-of-stock' : ''}`} 
              onClick={() => !isDisabled && addToCart(product)}
              style={isDisabled ? { borderColor: isOutOfStock ? 'red' : '#f59e0b', backgroundColor: isOutOfStock ? '#fee2e2' : 'inherit', cursor: 'not-allowed', opacity: 0.55 } : {}}
            >
              {/* Image wrapper with position:relative so ribbon can overlay it */}
              <div style={{ position: 'relative' }}>
                {product.image && <img src={product.image} alt={product.name} className="order-img-thumb" style={{ filter: isDisabled ? 'grayscale(60%)' : 'none', display: 'block' }} />}
                {isOutOfStock && (
                  <div style={{
                    position: 'absolute', top: 6, left: 6, zIndex: 2,
                    backgroundColor: '#dc2626', color: '#fff',
                    fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                    borderRadius: '4px', letterSpacing: '0.5px'
                  }}>HABIS</div>
                )}
                {!isOutOfStock && isCartCapped && (
                  <div style={{
                    position: 'absolute', top: 6, left: 6, zIndex: 2,
                    backgroundColor: '#f59e0b', color: '#fff',
                    fontSize: '10px', fontWeight: 700, padding: '2px 8px',
                    borderRadius: '4px', letterSpacing: '0.5px'
                  }}>Maksimum</div>
                )}
              </div>
              <div className="product-card-bottom">
                <div className="product-info">
                  <h3 className="product-name" style={{ color: isOutOfStock ? '#b91c1c' : isCartCapped ? '#92400e' : 'inherit' }}>{product.name}</h3>
                  <p className="product-price">Rp {product.price.toLocaleString('id-ID')}</p>
                </div>
                {!isDisabled && <div className="add-btn">+</div>}
              </div>
            </div>
          );
        })}
      </div>
      )}

      <div className="cart-section">
        <h2 className="section-title">Pesanan Saat Ini</h2>
        {cart.length === 0 ? (
          <p className="empty-cart">Keranjang kosong</p>
        ) : (
          <div className="cart-items">
            {cart.map(item => (
              <div key={item.id} className="cart-item">
                <div className="item-details">
                  <span className="item-name">{item.name}</span>
                  <span className="item-price">(Rp {(item.price * item.quantity).toLocaleString('id-ID')})</span>
                </div>
                <div className="qty-controls">
                  <button className="qty-btn" onClick={() => removeFromCart(item.id)}>-</button>
                  <span className="qty-value">{item.quantity}</span>
                  <button 
                    className="qty-btn" 
                    onClick={() => addToCart(item)}
                    disabled={item.quantity >= item.stock}
                    style={{ opacity: item.quantity >= item.stock ? 0.3 : 1, cursor: item.quantity >= item.stock ? 'not-allowed' : 'pointer' }}
                  >+</button>
                </div>
              </div>
            ))}
            <div ref={cartEndRef} />
          </div>
        )}

        <div className="cart-summary">
          <div className="total-row">
            <span>Total</span>
            <span className="total-amount">Rp {cartTotal.toLocaleString('id-ID')}</span>
          </div>
          <button 
            className="btn-primary checkout-btn" 
            onClick={handleCheckout}
            disabled={cart.length === 0}
            style={{ opacity: cart.length === 0 ? 0.5 : 1 }}
          >
            Proses Pembayaran
          </button>
        </div>
      </div>
    </div>
  );
}

export default Order;
