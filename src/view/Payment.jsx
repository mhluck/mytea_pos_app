import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { transactionModel } from '../model/transaction_model';
import { db } from '../model/db';
import { PrinterService } from '../services/PrinterService';
import { ArrowLeft, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useHardwareBack } from '../hooks/useHardwareBack';
import './Payment.css';

function Payment() {
  const location = useLocation();
  const navigate = useNavigate();
  const { cart, cartTotal } = location.state || { cart: [], cartTotal: 0 };
  
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' or 'qris'
  const [cashReceived, setCashReceived] = useState('');
  const [showQrisModal, setShowQrisModal] = useState(false);
  const [shopName, setShopName] = useState('');
  const [qrisImage, setQrisImage] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState(null);

  const [isPrinted, setIsPrinted] = useState(false);
  const [showPrintWarning, setShowPrintWarning] = useState(false);

  useHardwareBack(() => {
    if (showQrisModal) {
      setShowQrisModal(false);
    } else if (showSuccessModal) {
      setShowSuccessModal(false);
    } else {
      navigate(-1);
    }
  });

  useEffect(() => {
    setShopName(localStorage.getItem('shopName') || '');
    setQrisImage(localStorage.getItem('qrisImage') || '');
  }, []);

  // Suggested amounts based on total
  const suggestedAmounts = [
    cartTotal,
    Math.ceil(cartTotal / 10000) * 10000,
    Math.ceil(cartTotal / 50000) * 50000,
    Math.ceil(cartTotal / 100000) * 100000,
  ].filter((v, i, a) => a.indexOf(v) === i && v >= cartTotal); // unique and >= total

  const handleAmountClick = (amount) => {
    setCashReceived(amount.toString());
  };

  const handlePayment = async () => {
    let amount = 0;
    
    if (paymentMethod === 'cash') {
      amount = parseInt(cashReceived);
      if (!amount || amount < cartTotal) {
        toast.error("Jumlah uang harus lebih besar atau sama dengan total pembayaran.");
        return;
      }
    } else if (paymentMethod === 'qris') {
      amount = cartTotal; // For QRIS, we assume exact payment
    }

    try {
      setIsProcessing(true);

      // Stock Validation — read directly from DB to avoid stale React state
      let isStockValid = true;
      let stockErrorMessage = '';

      for (const item of cart) {
        const productInDb = await db.products.get(item.id);

        if (!productInDb) {
          isStockValid = false;
          stockErrorMessage = `Produk "${item.name}" tidak ditemukan di database.`;
          break;
        }

        if (productInDb.stock < item.quantity) {
          isStockValid = false;
          stockErrorMessage = `Stok tidak cukup! "${item.name}" hanya tersisa ${productInDb.stock}. Anda memasukkan ${item.quantity}.`;
          break;
        }
      }

      if (!isStockValid) {
        toast.error(stockErrorMessage);
        setIsProcessing(false);
        return;
      }

      const { transactionId } = await transactionModel.processCheckout(cart, cartTotal, amount, paymentMethod);
      
      const newTransactionData = {
        id: transactionId,
        items: cart,
        date: new Date().toISOString(),
        total: cartTotal,
        received: amount,
        change: paymentMethod === 'cash' ? amount - cartTotal : 0,
        method: paymentMethod
      };

      setCompletedTransaction(newTransactionData);
      setShowSuccessModal(true);
      localStorage.removeItem('persistentCart'); // Clear persisted cart on success
    } catch (error) {
      console.error("Checkout failed", error);
      toast.error("Pembayaran gagal. Silakan coba lagi.");
    } finally {
      setIsProcessing(false);
      setShowQrisModal(false);
    }
  };

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      await PrinterService.printReceipt(completedTransaction);
      
      toast.success("Struk berhasil dicetak.");
      setIsPrinted(true);
    } catch (error) {
      console.error(error);
      setIsPrinting(false);
      if (error.message !== 'BLUETOOTH_OFF') {
        toast.error("Gagal terhubung ke printer. Pastikan printer menyala.");
      }
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="payment-container">
      <div className="header-row">
        <button className="back-btn" onClick={() => navigate(-1)}>
          <ArrowLeft size={24} />
        </button>
        <h1 className="header-title">Pembayaran</h1>
        <div style={{width: 24}}></div> {/* Spacer for flex balance */}
      </div>

      <div className="payment-summary">
        <p className="summary-label">Total Tagihan</p>
        <h2 className="summary-amount">Rp {cartTotal.toLocaleString('id-ID')}</h2>
      </div>

      <div className="payment-method-toggle">
        <button 
          className={`payment-method-btn ${paymentMethod === 'cash' ? 'active' : ''}`}
          onClick={() => setPaymentMethod('cash')}
        >
          Tunai
        </button>
        <button 
          className={`payment-method-btn ${paymentMethod === 'qris' ? 'active' : ''}`}
          onClick={() => setPaymentMethod('qris')}
        >
          QRIS Statis
        </button>
      </div>

      {paymentMethod === 'cash' && (
        <>
          <div className="payment-input-section">
            <label className="input-label">Uang Diterima</label>
            <div className="input-wrapper">
              <span className="currency-prefix">Rp</span>
              <input
                type="number"
                className="payment-input"
                placeholder="0"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
              />
            </div>

            <div className="suggested-amounts">
              {suggestedAmounts.map(amount => (
                <button 
                  key={amount} 
                  className={`suggested-btn ${cashReceived === amount.toString() ? 'selected' : ''}`}
                  onClick={() => handleAmountClick(amount)}
                >
                  Rp {amount.toLocaleString('id-ID')}
                </button>
              ))}
            </div>
          </div>

          {parseInt(cashReceived) >= cartTotal && (
            <div className="change-preview">
              <span>Kembalian</span>
              <span className="change-amount-value">
                Rp {(parseInt(cashReceived) - cartTotal).toLocaleString('id-ID')}
              </span>
            </div>
          )}
        </>
      )}

      {paymentMethod === 'qris' && (
        <div className="payment-qris-section">
          <button className="payment-btn-show-qris" onClick={() => setShowQrisModal(true)}>
            Tampilkan QRIS
          </button>
        </div>
      )}

      <button 
        className="btn-primary confirm-payment-btn" 
        onClick={handlePayment}
        disabled={isProcessing || (paymentMethod === 'cash' && (!cashReceived || parseInt(cashReceived) < cartTotal))}
      >
        {isProcessing ? 'Memproses...' : 'Konfirmasi Pembayaran'}
      </button>

      {/* QRIS Modal */}
      {showQrisModal && (
        <div className="payment-qris-modal-overlay">
          <div className="payment-qris-modal-content">
            <div className="payment-qris-modal-header">
              <h3>Scan untuk Membayar</h3>
              <button className="payment-qris-close-btn" onClick={() => setShowQrisModal(false)}>
                <X size={24} />
              </button>
            </div>
            
            <div className="payment-qris-body">
              <h2 className="payment-qris-shop-name">{shopName || 'Shop Name'}</h2>
              <p className="payment-qris-bill">Rp. {cartTotal.toLocaleString('id-ID')}</p>
              
              <div className="payment-qris-image-container">
                {qrisImage ? (
                  <img src={qrisImage} alt="QRIS Kedai" className="payment-qris-image" />
                ) : (
                  <div className="payment-qris-placeholder">
                    <p>Gambar QRIS belum diatur di Profil Toko</p>
                  </div>
                )}
              </div>
            </div>

            <button className="payment-btn-close-modal" onClick={() => setShowQrisModal(false)}>
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && completedTransaction && (
        <div className="payment-modal-overlay">
          <div className="payment-modal-content">
            {showPrintWarning ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <h2 style={{ marginBottom: '16px' }}>Pengingat</h2>
                <p style={{ fontSize: '16px', color: 'var(--text-color)', marginBottom: '24px', lineHeight: '1.5' }}>
                  Apakah Anda ingin mencetak struk untuk transaksi ini?
                </p>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    className="btn-secondary" 
                    onClick={() => navigate('/')}
                    style={{ flex: 1, padding: '14px', fontSize: '16px' }}
                  >
                    Lewati
                  </button>
                  <button 
                    className="btn-primary" 
                    onClick={async () => {
                      await handlePrint();
                      navigate('/');
                    }}
                    style={{ flex: 1, padding: '14px', fontSize: '16px' }}
                  >
                    Cetak Struk
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 style={{ color: 'var(--primary-color)', marginBottom: '8px', textAlign: 'center' }}>Pembayaran Berhasil!</h2>
                
                <div className="payment-receipt">
                  <div className="receipt-row">
                    <span>Metode</span>
                    <strong style={{textTransform: 'uppercase'}}>{completedTransaction.method}</strong>
                  </div>
                  <div className="receipt-row">
                    <span>Total Tagihan</span>
                    <strong>Rp {completedTransaction.total.toLocaleString('id-ID')}</strong>
                  </div>
                  <div className="receipt-row">
                    <span>Uang Diterima</span>
                    <strong>Rp {completedTransaction.received.toLocaleString('id-ID')}</strong>
                  </div>
                  <div className="receipt-row change-row">
                    <span>Kembalian</span>
                    <strong className="change-text">Rp {completedTransaction.change.toLocaleString('id-ID')}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                  <button 
                    className="btn-primary" 
                    onClick={() => {
                      setShowPrintWarning(true);
                    }}
                    style={{ flex: 1, padding: '16px', fontSize: '16px' }}
                  >
                    Oke
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Payment;

