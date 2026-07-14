import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ImagePlus, RefreshCcw, Save, X, Lock, Unlock } from 'lucide-react';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { BleClient } from '@capacitor-community/bluetooth-le';
import Cropper from 'react-easy-crop';
import { useHardwareBack } from '../hooks/useHardwareBack';
import { getCroppedImg } from '../utils/cropImage';
import './Settings.css';

function Settings() {
  const navigate = useNavigate();

  const [shopLogo, setShopLogo] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopContact, setShopContact] = useState('');
  const [qrisImage, setQrisImage] = useState(null);
  const [printerMacAddress, setPrinterMacAddress] = useState('');
  const [printerName, setPrinterName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [isScanning, setIsScanning] = useState(false);

  const [isWebhookLocked, setIsWebhookLocked] = useState(true);
  const webhookInputRef = useRef(null);

  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [cropType, setCropType] = useState('logo'); // 'logo' or 'qris'
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const fileInputRef = useRef(null);
  const qrisInputRef = useRef(null);

  useEffect(() => {
    let listener = null;
    const setupListener = async () => {
      listener = await App.addListener('backButton', () => {
        if (showWebhookModal) {
          setShowWebhookModal(false);
        } else if (showCropModal) {
          setShowCropModal(false);
        } else if (showPermissionModal) {
          setShowPermissionModal(false);
        } else {
          window.history.back();
        }
      });
    };
    setupListener();

    return () => {
      if (listener) {
        listener.remove();
      }
    };
  }, [showWebhookModal, showCropModal, showPermissionModal]);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    try {
      const croppedImageBase64 = await getCroppedImg(cropImageSrc, croppedAreaPixels);
      if (cropType === 'logo') {
        setShopLogo(croppedImageBase64);
      } else {
        setQrisImage(croppedImageBase64);
      }
      setShowCropModal(false);
      setCropImageSrc(null);
    } catch (e) {
      toast.error('Gagal memotong gambar.');
      console.error(e);
    }
  };

  // Load from localStorage on mount
  useEffect(() => {
    setShopLogo(localStorage.getItem('shopLogo') || '');
    setShopName(localStorage.getItem('shopName') || '');
    setShopAddress(localStorage.getItem('shopAddress') || '');
    setShopContact(localStorage.getItem('shopContact') || '');
    setQrisImage(localStorage.getItem('qrisImage') || null);
    setPrinterMacAddress(localStorage.getItem('printerMacAddress') || '');
    setPrinterName(localStorage.getItem('printerName') || '');
    setWebhookUrl(localStorage.getItem('webhookUrl') || '');
  }, []);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCropType('logo');
      setCropImageSrc(event.target.result);
      setShowCropModal(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const handleQrisUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCropType('qris');
      setCropImageSrc(event.target.result);
      setShowCropModal(true);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset input
  };

  const requestBluetoothPermissions = async () => {
    return new Promise((resolve) => {
      if (Capacitor.isNativePlatform() && window.bluetoothSerial) {
        window.bluetoothSerial.isEnabled(
          () => {
            resolve(true);
          },
          () => {
            setShowPermissionModal(true);
            resolve(false);
          }
        );
      } else {
        resolve(true); // For web debugging fallback
      }
    });
  };

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      requestBluetoothPermissions();
    }
  }, []);

  const handleScanPrinters = async () => {
    setIsScanning(true);
    
    if (Capacitor.isNativePlatform()) {
      try {
        await BleClient.initialize();
        // Request LE scan just to force Android to display the "Nearby Devices" permission pop-up if not granted
        await BleClient.requestLEScan({}, () => {}); 
        setTimeout(async () => {
          await BleClient.stopLEScan();
        }, 1000);
      } catch (err) {
        console.warn("BLE Permission popup trigger failed or cancelled:", err);
      }
    }

    const hasPermission = await requestBluetoothPermissions();
    if (!hasPermission) {
      setIsScanning(false);
      return;
    }
    
    if (Capacitor.isNativePlatform() && window.bluetoothSerial) {
      window.bluetoothSerial.list((devices) => {
        const formattedDevices = devices.map(d => ({
          name: d.name || 'Perangkat Tidak Dikenal',
          mac: d.address || d.id
        }));
        setAvailablePrinters(formattedDevices);
        setIsScanning(false);
      }, (err) => {
        console.error(err);
        toast.error("Gagal mendapatkan daftar perangkat Bluetooth: " + err);
        setIsScanning(false);
      });
    } else {
      console.warn("Not running natively or bluetoothSerial plugin not available. Mocking device list.");
      setTimeout(() => {
        setAvailablePrinters([
          { name: 'POS-58 (Mock)', mac: '00:11:22:33:44:55' },
          { name: 'Panda Print (Mock)', mac: 'AA:BB:CC:DD:EE:FF' }
        ]);
        setIsScanning(false);
      }, 1500);
    }
  };

  const saveSettings = () => {
    if (webhookUrl && !webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
      toast.error('Gagal: Format URL Webhook tidak valid!');
      return;
    }

    localStorage.setItem('shopLogo', shopLogo);
    localStorage.setItem('shopName', shopName);
    localStorage.setItem('shopAddress', shopAddress);
    localStorage.setItem('shopContact', shopContact);
    if (qrisImage) {
      localStorage.setItem('qrisImage', qrisImage);
    } else {
      localStorage.removeItem('qrisImage');
    }
    localStorage.setItem('printerMacAddress', printerMacAddress);
    localStorage.setItem('printerName', printerName);
    localStorage.setItem('webhookUrl', webhookUrl);
    
    setIsWebhookLocked(true);
    navigate('/');
    toast.success('Pengaturan berhasil disimpan!');
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <ArrowLeft className="settings-back-btn" onClick={() => navigate(-1)} size={24} />
        <h2 className="settings-title">Pengaturan Profil & Toko</h2>
        <div style={{ width: 24 }}></div> {/* Spacer for alignment */}
      </div>

      <div className="settings-content">
        <div className="settings-card">
          <h3 className="settings-section-title">Detail Toko</h3>
          
          <div className="settings-form-group">
            <label className="settings-label">Logo Toko</label>
            <div 
              className="settings-image-uploader" 
              onClick={() => fileInputRef.current.click()}
            >
              {shopLogo ? (
                <img src={shopLogo} alt="Shop Logo" className="settings-logo-preview" />
              ) : (
                <div className="settings-image-placeholder">
                  <ImagePlus size={32} />
                  <span>Unggah Logo</span>
                </div>
              )}
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                className="settings-file-input"
              />
            </div>
          </div>

          <div className="settings-form-group">
            <label className="settings-label">Nama Toko</label>
            <input 
              type="text" 
              className="settings-input" 
              value={shopName} 
              onChange={(e) => setShopName(e.target.value)} 
              placeholder="Masukkan nama toko" 
            />
          </div>

          <div className="settings-form-group">
            <label className="settings-label">Alamat Toko</label>
            <textarea 
              className="settings-textarea" 
              value={shopAddress} 
              onChange={(e) => setShopAddress(e.target.value)} 
              placeholder="Masukkan alamat toko" 
            />
          </div>

          <div className="settings-form-group">
            <label className="settings-label">Nomor Kontak</label>
            <input 
              type="tel" 
              className="settings-input" 
              value={shopContact} 
              onChange={(e) => setShopContact(e.target.value)} 
              placeholder="Masukkan nomor kontak" 
            />
          </div>
        </div>

        <div className="settings-card">
          <h3 className="settings-section-title">Integrasi Pembayaran</h3>
          <div className="settings-form-group">
            <label className="settings-label">Unggah Gambar QRIS</label>
            <div 
              className="settings-qris-uploader" 
              onClick={() => qrisInputRef.current.click()}
            >
              {qrisImage ? (
                <img src={qrisImage} alt="QRIS Preview" className="settings-qris-preview" />
              ) : (
                <div className="settings-image-placeholder">
                  <ImagePlus size={32} />
                  <span>Belum ada gambar QRIS.</span>
                </div>
              )}
              <input 
                type="file" 
                accept="image/*" 
                ref={qrisInputRef} 
                onChange={handleQrisUpload} 
                className="settings-file-input"
              />
            </div>
          </div>
        </div>

        <div className="settings-card">
          <h3 className="settings-section-title">Perangkat Keras</h3>
          <div className="settings-form-group">
            <label className="settings-label">Printer Bluetooth</label>
            <div className="settings-printer-row">
              <select 
                className="settings-select" 
                value={printerMacAddress} 
                onChange={(e) => {
                  setPrinterMacAddress(e.target.value);
                  const selected = availablePrinters.find(p => p.mac === e.target.value);
                  if (selected) {
                    setPrinterName(selected.name);
                  }
                }}
              >
                <option value="">Pilih printer...</option>
                {availablePrinters.map(p => (
                  <option key={p.mac} value={p.mac}>{p.name} ({p.mac})</option>
                ))}
                {printerMacAddress && !availablePrinters.find(p => p.mac === printerMacAddress) && (
                  <option value={printerMacAddress}>Printer Tersimpan ({printerMacAddress})</option>
                )}
              </select>
              <button className="settings-btn-secondary" onClick={handleScanPrinters} disabled={isScanning}>
                {isScanning ? <span className="settings-loader"></span> : <RefreshCcw size={18} />}
              </button>
            </div>
            <p className="settings-help-text">Pindai printer Bluetooth ESC/POS di sekitar.</p>
          </div>
        </div>

        <div className="settings-card">
          <h3 className="settings-section-title">Pengaturan Pengembang</h3>
          <div className="settings-form-group">
            <label className="settings-label">URL Webhook (Sinkronisasi Data)</label>
            <div className="settings-printer-row">
              <input 
                type="url" 
                className="settings-input" 
                value={webhookUrl} 
                onChange={(e) => setWebhookUrl(e.target.value)} 
                placeholder="https://example.com/api/webhook" 
                disabled={isWebhookLocked}
                ref={webhookInputRef}
              />
              <button 
                className="settings-btn-secondary" 
                onClick={() => {
                  if (isWebhookLocked) {
                    setShowWebhookModal(true);
                  } else {
                    setIsWebhookLocked(true);
                  }
                }}
              >
                {isWebhookLocked ? <Lock size={18} /> : <Unlock size={18} />}
              </button>
            </div>
          </div>
        </div>

        <div className="settings-footer" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button className="settings-btn-primary" onClick={saveSettings}>
            <span>Simpan Pengaturan</span>
          </button>
          <button className="settings-btn-cancel" onClick={() => navigate('/')}>
            Batal
          </button>
        </div>
      </div>

      {showCropModal && cropImageSrc && (
        <div className="crop-modal-overlay">
          <div className="crop-modal-content">
            <div className="crop-modal-header">
              <h3>Potong Gambar</h3>
              <button className="crop-modal-close" onClick={() => setShowCropModal(false)}>
                <X size={24} />
              </button>
            </div>
            <div className="crop-container-wrapper">
              <Cropper
                image={cropImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={cropType === 'logo' ? 1 : 5/7}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            </div>
            <div className="modal-actions" style={{ padding: '0 16px 16px 16px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowCropModal(false)}>Batal</button>
              <button type="button" className="btn-primary" onClick={handleCropSave}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {showWebhookModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <h2 className="modal-title" style={{ color: '#000000' }}>Peringatan Sistem</h2>
            <p style={{ marginBottom: '20px', color: 'var(--text-light)' }}>
              Mengubah URL Webhook dapat mematikan fitur sinkronisasi data ke Cloud. Apakah Anda yakin ingin mengedit pengaturan ini?
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowWebhookModal(false)}>Batal</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => {
                setShowWebhookModal(false);
                setIsWebhookLocked(false);
                setTimeout(() => webhookInputRef.current?.focus(), 0);
              }}>Oke</button>
            </div>
          </div>
        </div>
      )}

      {showPermissionModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ textAlign: 'center' }}>
            <h2 className="modal-title" style={{ color: '#000000' }}>Izin Bluetooth Diperlukan</h2>
            <p style={{ marginBottom: '20px', color: 'var(--text-light)' }}>
              Mohon izinkan akses Perangkat di Sekitar (Nearby Devices) pada pengaturan HP Anda, atau nyalakan Bluetooth untuk menghubungkan printer.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowPermissionModal(false)}>Batal</button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={() => {
                setShowPermissionModal(false);
                if (window.bluetoothSerial && window.bluetoothSerial.showBluetoothSettings) {
                  window.bluetoothSerial.showBluetoothSettings();
                } else {
                  toast.error("Silakan buka Pengaturan HP Anda secara manual.");
                }
              }}>Buka Pengaturan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Settings;
