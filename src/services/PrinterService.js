import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

export const PrinterService = {
  checkBluetoothEnabled: () => {
    return new Promise((resolve) => {
      if (!Capacitor.isNativePlatform() || !window.bluetoothSerial) {
        return resolve(true);
      }
      window.bluetoothSerial.isEnabled(
        () => resolve(true),
        () => resolve(false)
      );
    });
  },

  checkBluetoothConnected: () => {
    return new Promise((resolve) => {
      if (!Capacitor.isNativePlatform() || !window.bluetoothSerial) {
        return resolve(true);
      }
      window.bluetoothSerial.isConnected(
        () => resolve(true),
        () => resolve(false)
      );
    });
  },

  // 1. Connect to printer
  connectPrinter: (macAddress) => {
    return new Promise((resolve, reject) => {
      if (!Capacitor.isNativePlatform() || !window.bluetoothSerial) {
        console.warn("Not running natively or bluetoothSerial plugin not available. Mocking connection.");
        // Mock connection for browser
        setTimeout(() => resolve("Mock connected"), 500);
        return;
      }

      window.bluetoothSerial.connect(
        macAddress,
        () => resolve("Connected successfully"),
        (err) => reject(new Error("Failed to connect: " + err))
      );
    });
  },

  // Disconnect utility
  disconnectPrinter: () => {
    return new Promise((resolve, reject) => {
      if (!Capacitor.isNativePlatform() || !window.bluetoothSerial) {
        resolve("Mock disconnected");
        return;
      }
      window.bluetoothSerial.disconnect(resolve, reject);
    });
  },

  // 2. Format Receipt
  formatReceipt: (transactionData, shopSettings) => {
    // ESC/POS Commands
    const ESC_INIT = '\x1B\x40'; // Initialize
    const ALIGN_CENTER = '\x1B\x61\x01';
    const ALIGN_LEFT = '\x1B\x61\x00';
    const BOLD_ON = '\x1B\x45\x01';
    const BOLD_OFF = '\x1B\x45\x00';
    const PAPER_CUT = '\x1D\x56\x00'; // Cut
    const LF = '\n';
    const LINE = '--------------------------------'; // 32 chars for 58mm

    // Helper to format currency
    const rp = (val) => `Rp${Number(val).toLocaleString('id-ID')}`;

    // Helper to pad strings for left-right alignment on 32 char line
    const formatLine = (leftText, rightText) => {
      const leftStr = leftText.toString();
      const rightStr = rightText.toString();
      const spaces = 32 - leftStr.length - rightStr.length;
      if (spaces > 0) {
        return leftStr + ' '.repeat(spaces) + rightStr;
      }
      // If overflow, truncate left side a bit
      return leftStr.substring(0, 32 - rightStr.length - 1) + ' ' + rightStr;
    };

    let receipt = '';
    receipt += ESC_INIT;

    // Header
    receipt += ALIGN_CENTER;
    receipt += BOLD_ON + (shopSettings.shopName || 'My Tea').toUpperCase() + BOLD_OFF + LF;
    if (shopSettings.shopAddress) {
      receipt += shopSettings.shopAddress + LF;
    }
    if (shopSettings.shopContact) {
      receipt += shopSettings.shopContact + LF;
    }

    receipt += ALIGN_LEFT;
    receipt += LINE + LF;

    // Transaction Info
    const txDate = new Date(transactionData.date || Date.now()).toLocaleString('id-ID');
    receipt += `No Pesanan: #${transactionData.id}` + LF;
    receipt += `Tanggal: ${txDate}` + LF;
    receipt += LINE + LF;

    // Items
    if (transactionData.items && transactionData.items.length > 0) {
      transactionData.items.forEach(item => {
        let nameStr = item.name;
        while (nameStr.length > 32) {
          receipt += nameStr.substring(0, 32) + LF;
          nameStr = nameStr.substring(32);
        }
        receipt += nameStr + LF;

        const qtyPrice = `${item.quantity}x @ ${rp(item.price)}`;
        const totalLine = rp(item.price * item.quantity);
        receipt += formatLine(qtyPrice, totalLine) + LF;
      });
    } else {
      receipt += "Tidak ada item" + LF;
    }
    receipt += LINE + LF;

    // Footer summary
    receipt += BOLD_ON;
    receipt += formatLine('Total', rp(transactionData.total)) + LF;
    receipt += BOLD_OFF;

    receipt += formatLine('Metode', (transactionData.method || 'cash').toUpperCase()) + LF;
    receipt += formatLine('Diterima', rp(transactionData.received || transactionData.payment || 0)) + LF;
    receipt += formatLine('Kembalian', rp(transactionData.change || 0)) + LF;

    receipt += LINE + LF;

    // Footer message
    receipt += ALIGN_CENTER;
    receipt += "Terima Kasih!" + LF;
    receipt += "Silakan datang kembali" + LF + LF;

    // Feed and Cut
    receipt += LF;
    receipt += PAPER_CUT;

    return receipt;
  },

  // Convert Base64 Image to ESC/POS Monochrome Raster Bit-Image (GS v 0)
  getLogoBytes: async (base64String) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');

        let width = 120; // Reduce logo resolution to approx 15mm
        let height = Math.floor(img.height * (120 / img.width));

        // Ensure width is a multiple of 8 for ESC/POS bits
        width = Math.floor(width / 8) * 8;

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Fill white background just in case of transparency
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        ctx.drawImage(img, 0, 0, width, height);

        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Monochrome conversion
        const widthBytes = width / 8;
        const xL = widthBytes % 256;
        const xH = Math.floor(widthBytes / 256);
        const yL = height % 256;
        const yH = Math.floor(height / 256);

        // Raster bit-image ESC/POS command: GS v 0 0 xL xH yL yH
        const header = [0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH];

        // Calculate total bytes: align center + header length + (widthBytes * height) + line feeds
        const alignCenter = [0x1B, 0x61, 0x01]; // ESC a 1
        const totalBytes = alignCenter.length + header.length + (widthBytes * height) + 3;
        const buffer = new Uint8Array(totalBytes);

        let offset = 0;

        // Center image
        for (let i = 0; i < alignCenter.length; i++) {
          buffer[offset++] = alignCenter[i];
        }

        // Image header
        for (let i = 0; i < header.length; i++) {
          buffer[offset++] = header[i];
        }

        // Pack pixels into bits
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < widthBytes; x++) {
            let byte = 0;
            for (let b = 0; b < 8; b++) {
              const px = y * width + (x * 8 + b);
              const idx = px * 4;
              const r = data[idx];
              const g = data[idx + 1];
              const b_color = data[idx + 2];

              const brightness = (r + g + b_color) / 3;
              if (brightness < 128) {
                // Black pixel
                byte |= (1 << (7 - b));
              }
            }
            buffer[offset++] = byte;
          }
        }

        // Add padding newlines after image
        buffer[offset++] = 10; // LF

        // Shrink the buffer to its actual used length to avoid extra empty bytes
        const finalBuffer = buffer.slice(0, offset);
        resolve(finalBuffer);
      };
      img.src = base64String;
    });
  },

  writePromise: (uint8ArrayData) => {
    return new Promise((resolve, reject) => {
      window.bluetoothSerial.write(
        uint8ArrayData.buffer,
        () => resolve(),
        (err) => reject(new Error("Failed to write to printer: " + err))
      );
    });
  },

  // 3. Main print function
  printReceipt: async (transactionData) => {
    const isEnabled = await PrinterService.checkBluetoothEnabled();
    if (!isEnabled) {
      toast.error("Harap nyalakan Bluetooth HP Anda.");
      return Promise.reject(new Error('BLUETOOTH_OFF'));
    }

    const shopSettings = {
      shopName: localStorage.getItem('shopName') || '',
      shopAddress: localStorage.getItem('shopAddress') || '',
      shopContact: localStorage.getItem('shopContact') || ''
    };

    const macAddress = localStorage.getItem('printerMacAddress');
    const logoBase64 = localStorage.getItem('shopLogo');

    const receiptText = PrinterService.formatReceipt(transactionData, shopSettings);

    if (!Capacitor.isNativePlatform() || !window.bluetoothSerial) {
      console.log("=== RAW RECEIPT (BROWSER MOCK) ===");
      if (logoBase64) console.log("[LOGO IMAGE PRESENT]");
      console.log(receiptText);
      console.log("==================================");
      return Promise.resolve("Printed to console");
    }

    if (!macAddress) {
      return Promise.reject(new Error("No printer MAC address configured. Please set it in Settings."));
    }

    try {
      const isConnected = await PrinterService.checkBluetoothConnected();
      if (!isConnected) {
        try {
          await PrinterService.connectPrinter(macAddress);
        } catch (connErr) {
          return Promise.reject(new Error('PRINTER_OFF'));
        }
      }

      const textBytes = new Uint8Array(receiptText.split('').map(c => c.charCodeAt(0)));

      if (logoBase64) {
        const logoBytes = await PrinterService.getLogoBytes(logoBase64);

        // 1. Send Logo Data
        await PrinterService.writePromise(logoBytes);

        // 2. Buffer Transfer Delay (prevent printer memory congestion)
        await new Promise(resolve => setTimeout(resolve, 800));

        // 3. Send Text Data (receiptText already begins with ESC_INIT \x1B\x40)
        await PrinterService.writePromise(textBytes);
      } else {
        await PrinterService.writePromise(textBytes);
      }

      // Do not disconnect to maintain connection for next prints
      return "Printed successfully";
    } catch (err) {
      PrinterService.disconnectPrinter(); // Clean up if write fails
      return Promise.reject(err);
    }
  }
};
