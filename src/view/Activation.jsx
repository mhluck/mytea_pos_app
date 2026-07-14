import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Device } from '@capacitor/device';
import { Clipboard } from '@capacitor/clipboard';
import { ShieldCheck, Copy, ClipboardPaste, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import './Activation.css';

function Activation() {
  const [deviceId, setDeviceId] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const navigate = useNavigate();

  const generateValidCode = async (id) => {
    const rawString = id + "KEDAI_ESTEH_SECURE_2026";
    const msgUint8 = new TextEncoder().encode(rawString);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    
    const truncated = hashHex.substring(0, 12).toUpperCase();
    return truncated.match(/.{1,4}/g).join('-');
  };

  useEffect(() => {
    const fetchDeviceId = async () => {
      try {
        const info = await Device.getId();
        let rawId = info.identifier || 'UNKNOWN-DEVICE';
        
        rawId = rawId.substring(0, 12).toUpperCase().padEnd(12, 'X');
        const formattedId = rawId.match(/.{1,4}/g).join('-');
        
        setDeviceId(formattedId);

        // Debugging only
        const validCode = await generateValidCode(formattedId);
        console.log("KODE RAHASIA:", validCode);
      } catch (error) {
        console.error("Error getting device ID", error);
        
        // Fallback for web debugging if Device.getId fails
        const fallbackId = "ABCD-1234-EFGH";
        setDeviceId(fallbackId);
        const validCode = await generateValidCode(fallbackId);
        console.log("KODE RAHASIA (Fallback):", validCode);
      }
    };
    fetchDeviceId();
  }, []);

  const handleActivate = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    
    if (!activationCode) return;

    try {
      const expectedCode = await generateValidCode(deviceId);
      
      if (activationCode.toUpperCase().trim() === expectedCode) {
        localStorage.setItem('isActivated', 'true');
        localStorage.setItem('deviceId', deviceId);
        toast.success("Perangkat berhasil diaktifkan!");
        navigate('/');
      } else {
        setErrorMessage("Kode Aktivasi tidak valid!");
      }
    } catch (error) {
      console.error(error);
      setErrorMessage("Terjadi kesalahan sistem.");
    }
  };

  const handleCopyDeviceId = async () => {
    if (deviceId) {
      try {
        await Clipboard.write({ string: deviceId });
        toast.success("Tersalin!");
      } catch (err) {
        toast.error("Gagal menyalin");
      }
    }
  };

  const handlePasteCode = async () => {
    try {
      const { value } = await Clipboard.read();
      const text = value;
      if (text) {
        let val = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (val.length > 12) val = val.substring(0, 12);
        const formatted = val.match(/.{1,4}/g)?.join('-') || val;
        setActivationCode(formatted);
      }
    } catch (err) {
      toast.error("Gagal menempelkan teks dari clipboard");
    }
  };

  const handleWhatsApp = () => {
    const waUrl = `https://wa.me/6285865222612?text=${encodeURIComponent('Halo Developer, saya ingin meminta kode aktivasi untuk Device ID: ' + deviceId)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="activation-container">
      <div className="activation-card">
        <div className="activation-icon-wrapper">
          <ShieldCheck size={32} />
        </div>
        
        <div>
          <h2 className="activation-title">Aktivasi Perangkat</h2>
          <p className="activation-subtitle">Silakan hubungi developer untuk mendapatkan kode aktivasi.</p>
        </div>

        <div className="device-id-box" style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <span className="device-id-label">Device ID Anda:</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="device-id-value">{deviceId || 'Memuat...'}</span>
            {deviceId && (
              <button 
                type="button" 
                onClick={handleCopyDeviceId} 
                style={{ background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Salin Device ID"
              >
                <Copy size={18} />
              </button>
            )}
          </div>
        </div>

        <form className="activation-form" onSubmit={handleActivate} style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', width: '100%' }}>
            <input 
              type="text" 
              className="activation-input" 
              placeholder="XXXX-XXXX-XXXX" 
              value={activationCode} 
              onChange={(e) => {
                let val = e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                if (val.length > 12) val = val.substring(0, 12);
                const formatted = val.match(/.{1,4}/g)?.join('-') || val;
                setActivationCode(formatted);
              }} 
              maxLength={14} 
              required 
              style={{ flex: 1, marginBottom: 0 }}
            />
            <button 
              type="button" 
              onClick={handlePasteCode}
              style={{ 
                padding: '12px', 
                backgroundColor: '#f5f5f5', 
                border: '1px solid #ddd', 
                borderRadius: '8px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-light)'
              }}
              title="Tempel Kode"
            >
              <ClipboardPaste size={20} />
            </button>
          </div>
          {errorMessage && <p className="error-message" style={{ marginTop: '8px' }}>{errorMessage}</p>}
          
          <button type="submit" className="btn-primary" style={{ marginTop: '16px', width: '100%' }}>
            Aktifkan Perangkat
          </button>

          <button 
            type="button" 
            onClick={handleWhatsApp}
            style={{ 
              marginTop: '12px', 
              width: '100%', 
              backgroundColor: '#fff', 
              color: '#128C7E', 
              border: '2px solid #128C7E', 
              borderRadius: 'var(--border-radius)', 
              padding: '12px 24px', 
              fontWeight: 600, 
              fontSize: '16px', 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              gap: '8px' 
            }}
          >
            <MessageCircle size={20} />
            Minta Kode via WhatsApp
          </button>
        </form>
      </div>
    </div>
  );
}

export default Activation;
