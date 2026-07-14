import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { productModel } from '../model/product_model';
import { Search, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useHardwareBack } from '../hooks/useHardwareBack';
import './Product.css';

function Stock() {
  const navigate = useNavigate();
  const products = useLiveQuery(() => productModel.getAllProducts()) || [];
  const [showModal, setShowModal] = useState(false);
  
  // Form State
  const [currentProduct, setCurrentProduct] = useState(null);
  const [newStock, setNewStock] = useState(0);

  useHardwareBack(() => {
    if (showModal) {
      setShowModal(false);
    } else {
      navigate('/');
    }
  });

  // Category & Search Filter State
  const [activeCategory, setActiveCategory] = useState('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = ['Semua', ...new Set(products.map(p => p.category || 'Uncategorized'))];
  const filteredProducts = products.filter(p => {
    const matchesCategory = activeCategory === 'Semua' || (p.category || 'Uncategorized').toLowerCase() === activeCategory.toLowerCase();
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleUpdateClick = (product) => {
    setCurrentProduct(product);
    setNewStock(product.stock);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentProduct) return;

    await productModel.updateProduct(currentProduct.id, {
      stock: newStock
    });
    
    toast.success('Stok berhasil diperbarui.');
    setShowModal(false);
  };

  return (
    <div className="product-container">
      <div className="header-row">
        <h1 className="header-title">Perbarui Stok</h1>
      </div>

      <div className="search-container" style={{ position: 'relative', marginBottom: '8px' }}>
        <input 
          id="searchInputStock"
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
                setTimeout(() => document.getElementById('searchInputStock')?.focus(), 0);
              }}
              style={{ background: 'none', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              <X size={20} strokeWidth={2} />
            </button>
          )}
          <button 
            type="button"
            onClick={() => document.getElementById('searchInputStock')?.blur()}
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
      <div className="product-list">
        {filteredProducts.map(product => {
              let stockLevelClass = 'stock-low';
              if (product.stock >= 60) stockLevelClass = 'stock-high';
              else if (product.stock >= 20) stockLevelClass = 'stock-medium';
              
              return (
              <div key={product.id} className="product-list-item" style={{ marginBottom: '8px' }}>
                <div className="item-info">
                  <h3 className="item-name">{product.name}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>Stok Saat Ini:</span>
                    <span className={`stock-badge ${stockLevelClass}`}>
                      {product.stock}
                    </span>
                  </div>
                </div>
                <div className="item-actions">
                  <button className="btn-primary" style={{ padding: '8px 16px', fontSize: '14px', width: 'auto' }} onClick={() => handleUpdateClick(product)}>
                    Perbarui
                  </button>
                </div>
              </div>
            );
        })}
      </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Perbarui Stok</h2>
            <p style={{marginBottom: 16, width: '100%', whiteSpace: 'normal', overflowWrap: 'break-word', wordBreak: 'break-all', hyphens: 'auto'}}>Produk: <strong>{currentProduct?.name}</strong></p>
            <form onSubmit={handleSubmit} className="product-form">
              <div className="form-group">
                <label>Stok Akhir (Cup)</label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <button 
                    type="button" 
                    onClick={() => setNewStock(prev => Math.max(0, prev - 1))}
                    style={{ backgroundColor: '#f5f5f5', color: '#dc2626', width: '48px', height: '48px', borderRadius: '8px', fontSize: '28px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >-</button>
                  <input 
                    type="number" 
                    value={newStock} 
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      setNewStock(isNaN(val) ? '' : val);
                    }} 
                    style={{ flex: 1, textAlign: 'center', fontSize: '18px', fontWeight: 'bold' }}
                    className="stepper-input"
                    required
                  />
                  <button 
                    type="button" 
                    onClick={() => setNewStock(prev => (prev || 0) + 1)}
                    style={{ backgroundColor: '#f5f5f5', color: 'var(--primary-color)', width: '48px', height: '48px', borderRadius: '8px', fontSize: '28px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >+</button>
                </div>
              </div>
              
              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                <button type="submit" className="btn-primary">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Stock;
