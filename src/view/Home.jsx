import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { transactionModel } from '../model/transaction_model';
import { productModel } from '../model/product_model';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { useHardwareBack } from '../hooks/useHardwareBack';
import { App } from '@capacitor/app';
import './Home.css';
import './Product.css';

function Home() {
  const todaysSales = useLiveQuery(() => transactionModel.getTodaysTotalSales()) || 0;
  const todaysOrders = useLiveQuery(() => transactionModel.getTodaysOrderCount()) || 0;
  const products = useLiveQuery(() => productModel.getAllProducts()) || [];
  const navigate = useNavigate();

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);

  useHardwareBack(() => {
    if (showProductModal) {
      setShowProductModal(false);
    } else {
      App.exitApp();
    }
  });


  return (
    <div className="home-container">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div className="header">
          <div className="header-top">
            <h2 className="date">{new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</h2>
            <Settings className="settings-icon" onClick={() => navigate('/settings')} />
          </div>
          <h1 className="title">Total Penjualan Hari Ini</h1>
          <h1 className="sales-amount">Rp {todaysSales.toLocaleString('id-ID')}</h1>
        </div>

        <div className="stats-section">
          <p className="item-label">TRANSAKSI</p>
          <h2 className="item-value">{todaysOrders} Order</h2>
        </div>
      </div>

      <div className="stock-section">
        <h2 className="section-title">Stok Produk</h2>
        <div className="stock-grid">
          {products.map(product => {
            let stockLevelClass = 'stock-low';
            if (product.stock >= 60) stockLevelClass = 'stock-high';
            else if (product.stock >= 20) stockLevelClass = 'stock-medium';

            return (
              <div key={product.id} className="stock-card" onClick={() => { setSelectedProduct(product); setShowProductModal(true); }} style={{ cursor: 'pointer' }}>
                {product.image && <img src={product.image} alt={product.name} className="stock-img-thumb" />}
                <h3 className="stock-name">{product.name}</h3>
                <div style={{ marginTop: '8px' }}>
                  <span className={`stock-badge ${stockLevelClass}`}>
                    {product.stock} Cup
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showProductModal && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content">
            {selectedProduct.image && (
              <img 
                src={selectedProduct.image} 
                alt={selectedProduct.name} 
                style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '8px', marginBottom: '16px' }}
              />
            )}
            <h2 className="modal-title" style={{ marginBottom: '8px' }}>{selectedProduct.name}</h2>
            <p style={{ fontSize: '18px', fontWeight: 'bold', color: 'var(--primary-color)', marginBottom: '12px' }}>
              Rp {selectedProduct.price?.toLocaleString('id-ID') || 0}
            </p>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <span style={{ 
                backgroundColor: '#f3f4f6', 
                padding: '4px 8px', 
                borderRadius: '4px', 
                fontSize: '12px', 
                fontWeight: 'bold',
                color: '#4b5563'
              }}>
                {selectedProduct.category || 'Uncategorized'}
              </span>
            </div>

            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', color: 'var(--text-light)', marginRight: '8px' }}>Sisa Stok:</span>
              <span className={`stock-badge ${selectedProduct.stock >= 60 ? 'stock-high' : selectedProduct.stock >= 20 ? 'stock-medium' : 'stock-low'}`}>
                {selectedProduct.stock} Cup
              </span>
            </div>

            <div className="modal-actions">
              <button className="btn-secondary" style={{ width: '100%' }} onClick={() => setShowProductModal(false)}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
