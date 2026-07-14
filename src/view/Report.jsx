import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { transactionModel } from '../model/transaction_model';
import { db } from '../model/db';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { useHardwareBack } from '../hooks/useHardwareBack';
import { PrinterService } from '../services/PrinterService';
import './Home.css';
import './Report.css';

const calculateReportSummary = (detailedTx) => {
  let productSummary = {};
  let paymentSummary = { CASH: 0, QRIS: 0 };
  let totalOmzet = 0;
  let totalItemsSold = 0;

  detailedTx.forEach(tx => {
    totalOmzet += tx.total;
    const methodStr = (tx.payment_method || 'cash').toUpperCase();
    if (paymentSummary[methodStr] !== undefined) {
      paymentSummary[methodStr] += tx.total;
    } else {
      paymentSummary[methodStr] = tx.total;
    }

    if (tx.items && tx.items.length > 0) {
      tx.items.forEach(item => {
        const pName = item.productName || 'Unknown';
        totalItemsSold += item.quantity;
        if (!productSummary[pName]) {
          productSummary[pName] = 0;
        }
        productSummary[pName] += item.quantity;
      });
    }
  });

  const sortedProducts = Object.keys(productSummary)
    .map(name => ({ name, qty: productSummary[name] }))
    .sort((a, b) => b.qty - a.qty);

  return {
    totalTransaksi: detailedTx.length,
    totalItemsSold,
    paymentSummary,
    totalOmzet,
    sortedProducts
  };
};

function Report() {
  const recentTransactions = useLiveQuery(() => transactionModel.getRecentTransactions()) || [];
  const todaysSales = useLiveQuery(() => transactionModel.getTodaysTotalSales()) || 0;
  const totalThisMonth = useLiveQuery(() => transactionModel.getThisMonthTotalSales()) || 0;
  
  const [selectedTx, setSelectedTx] = useState(null);
  const [txDetails, setTxDetails] = useState([]);
  const [isPrinting, setIsPrinting] = useState(false);
  
  const [showExportModal, setShowExportModal] = useState(false);
  const [reportMode, setReportMode] = useState('daily');
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [exportMonth, setExportMonth] = useState(new Date().getMonth());
  const [exportYear, setExportYear] = useState(new Date().getFullYear());
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const navigate = useNavigate();

  useHardwareBack(() => {
    if (showExportModal) {
      setShowExportModal(false);
    } else if (selectedTx) {
      closeModal();
    } else {
      navigate('/');
    }
  });

  // Live query for unsynced transactions
  const pendingSyncs = useLiveQuery(
    () => db.transactions.filter(trx => !trx.is_synced).toArray(),
    []
  ) || [];

  const handleTxClick = async (tx) => {
    setSelectedTx(tx);
    const details = await transactionModel.getTransactionDetails(tx.id);
    setTxDetails(details);
  };

  const closeModal = () => {
    setSelectedTx(null);
    setTxDetails([]);
  };

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handlePrintReceipt = async () => {
    if (!selectedTx) return;
    
    // Map txDetails to match PrinterService expectations (needs item.name)
    const itemsForPrint = txDetails.map(item => ({
      ...item,
      name: item.productName || item.name || 'Unknown Item'
    }));

    const transactionData = {
      id: selectedTx.id,
      date: selectedTx.date,
      total: selectedTx.total,
      payment: selectedTx.payment,
      change: selectedTx.change,
      method: selectedTx.payment_method,
      items: itemsForPrint
    };

    try {
      setIsPrinting(true);
      await PrinterService.printReceipt(transactionData);
      
      toast.success("Struk berhasil dicetak.");
    } catch (error) {
      console.error(error);
      if (error.message !== 'BLUETOOTH_OFF') {
        toast.error("Gagal terhubung ke printer. Pastikan printer menyala.");
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handleSyncToCloud = async () => {
    if (pendingSyncs.length === 0) return;

    const webhookUrl = localStorage.getItem('webhookUrl');
    if (!webhookUrl) {
      toast.error('Please enter the Webhook URL first in the Settings menu!');
      return;
    }

    setIsSyncing(true);
    try {
      // Enrich each transaction with its product items from the transaction_items table
      // (pendingSyncs from db.transactions never contains items — they live in a separate table)
      const enrichedTransactions = await Promise.all(
        pendingSyncs.map(async (trx) => {
          const items = await transactionModel.getTransactionDetails(trx.id);
          return {
            id: trx.id,
            date: trx.date || trx.createdAt,
            total: trx.total || trx.totalAmount,
            payment_method: trx.payment_method || trx.method,
            received: trx.payment || trx.received || trx.cashReceived || 0,
            change: trx.change || trx.changeAmount || 0,
            items: items || []
          };
        })
      );

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'backup',
          transactions: enrichedTransactions
        })
      });

      if (response.ok) {
        // Bulk-mark all synced transactions as is_synced: true in Dexie
        const ids = pendingSyncs.map(trx => trx.id);
        await db.transactions.bulkUpdate(ids.map(id => ({ key: id, changes: { is_synced: true } })));
        toast.success('Transaksi berhasil disinkronkan ke Cloud');
      } else {
        throw new Error(`Server returned status ${response.status}`);
      }
    } catch (err) {
      console.error('Sync failed:', err);
      toast.error('Gagal sinkronisasi transaksi, periksa koneksi Anda.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExportDrive = async () => {
    const webhookUrl = localStorage.getItem('webhookUrl');
    if (!webhookUrl) {
      toast.error('Please enter the Webhook URL first in the Settings menu!');
      return;
    }

    let detailedTx;
    let reportLabel;

    try {
      if (reportMode === 'daily') {
        if (!selectedDate) {
          toast.error('Please select a date first.');
          return;
        }
        reportLabel = `Sales Report (${new Date(selectedDate).toLocaleDateString('id-ID')})`;
        detailedTx = await transactionModel.getDetailedTransactionsByDate(selectedDate);
      } else {
        const monthIndex = parseInt(exportMonth);
        reportLabel = `Sales Report (${monthNames[monthIndex]} ${exportYear})`;
        detailedTx = await transactionModel.getDetailedTransactionsByMonth(exportYear, monthIndex);
      }
    } catch (dbError) {
      console.error("Database error during export:", dbError);
      toast.error(`Failed to read data: ${dbError.message || 'Database error'}`);
      return;
    }

    if (!detailedTx || detailedTx.length === 0) {
      toast.error("Tidak ada transaksi pada periode yang dipilih");
      return;
    }

    setIsUploadingToDrive(true);

    try {
      const summaryData = calculateReportSummary(detailedTx);

      const reportPayload = {
        action: 'report',
        metadata: {
          toko: localStorage.getItem('shopName') || "MyTea POS",
          jenis_laporan: "Laporan Penjualan",
          periode: reportLabel,
          waktu_ekspor: new Date().toLocaleString('id-ID')
        },
        ringkasan: {
          total_transaksi: summaryData.totalTransaksi,
          total_item: summaryData.totalItemsSold,
          total_tunai: summaryData.paymentSummary['CASH'] || 0,
          total_qris: summaryData.paymentSummary['QRIS'] || 0,
          total_omzet: summaryData.totalOmzet
        },
        rekap_produk: summaryData.sortedProducts.map(p => ({
          menu: p.name,
          terjual: p.qty
        })),
        detail_transaksi: detailedTx.map(trx => ({
          tanggal_waktu: new Date(trx.date).toLocaleString('id-ID'),
          no_pesanan: trx.id.toString(),
          detail_pesanan: trx.items && trx.items.length > 0 
            ? trx.items.map(i => `${i.productName} (x${i.quantity})`).join(', ') 
            : 'Tidak ada item',
          metode_pembayaran: (trx.payment_method || 'cash').toUpperCase(),
          total_belanja: trx.total,
          uang_diterima: trx.payment || 0,
          kembalian: trx.change || 0
        })),
        transactions: detailedTx.map(trx => ({
          ...trx,
          uang_diterima: trx.payment || 0,
          kembalian: trx.change || 0,
          received_amount: trx.received_amount || trx.received || trx.payment || trx.cashReceived || 0,
          change_amount: trx.change_amount || trx.change || 0
        }))
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(reportPayload)
      });

      const result = await response.json();
      
      if (result.status === 'successful' || result.status === 'success' || response.ok) {
        toast.success("Data berhasil terkirim ke Spreadsheet!");
        if (result.url) {
          window.open(result.url, '_blank');
        }
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(`Upload failed: ${error.message || 'Network error'}`);
    } finally {
      setIsUploadingToDrive(false);
      setShowExportModal(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      let detailedTx;
      let reportLabel;
      let fileName;

      try {
        if (reportMode === 'daily') {
          if (!selectedDate) {
            toast.error('Please select a date first.');
            return;
          }
          reportLabel = new Date(selectedDate).toLocaleDateString('id-ID');
          fileName = `Laporan_Penjualan_${selectedDate}.xlsx`;
          detailedTx = await transactionModel.getDetailedTransactionsByDate(selectedDate);
        } else {
          const monthIndex = parseInt(exportMonth, 10);
          reportLabel = `${monthNames[monthIndex]} ${exportYear}`;
          fileName = `Laporan_Penjualan_${monthNames[monthIndex]}_${exportYear}.xlsx`;
          detailedTx = await transactionModel.getDetailedTransactionsByMonth(exportYear, monthIndex);
        }
      } catch (dbError) {
        console.error("Database error during export:", dbError);
        toast.error(`Failed to read data: ${dbError.message || 'Database error'}`);
        return;
      }

      if (!detailedTx || detailedTx.length === 0) {
        toast.error("Tidak ada transaksi pada periode yang dipilih");
        return;
      }

      try {
        const workbook = new ExcelJS.Workbook();
        
        const summaryData = calculateReportSummary(detailedTx);
        const { totalTransaksi, totalItemsSold, paymentSummary, totalOmzet, sortedProducts } = summaryData;

        // Worksheet 1: Ringkasan
        const summarySheet = workbook.addWorksheet('Ringkasan');
        
        // 1. HEADER
        const header1 = summarySheet.addRow(['LAPORAN PENJUALAN MYTEA']);
        header1.font = { bold: true, size: 14 };
        summarySheet.addRow([`Periode: ${reportLabel}`]);
        const printTime = new Date().toLocaleString('id-ID');
        summarySheet.addRow([`Waktu Dicetak: ${printTime}`]);
        summarySheet.addRow([]); // Baris kosong

        // 2. RINGKASAN FINANSIAL
        const formatRp = (amount) => `Rp ${amount.toLocaleString('id-ID')}`;
        
        summarySheet.addRow(['Total Transaksi', detailedTx.length]);
        summarySheet.addRow(['Total Item Terjual', totalItemsSold]);
        summarySheet.addRow(['Total Pendapatan Tunai (CASH)', formatRp(paymentSummary['CASH'] || 0)]);
        summarySheet.addRow(['Total Pendapatan Non-Tunai (QRIS)', formatRp(paymentSummary['QRIS'] || 0)]);
        
        const omzetRow = summarySheet.addRow(['TOTAL OMZET', formatRp(totalOmzet)]);
        omzetRow.font = { bold: true };
        
        // Make the financial summary labels bold (Col A)
        for (let i = 5; i <= 9; i++) {
          summarySheet.getCell(`A${i}`).font = { bold: true };
        }

        summarySheet.addRow([]); // Baris kosong

        // 3. REKAPITULASI PRODUK TERJUAL
        const prodHeaderRow = summarySheet.addRow(['Nama Menu', 'Jumlah Terjual']);
        prodHeaderRow.font = { bold: true };
        prodHeaderRow.eachCell(cell => {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE2EFDA' }
          };
        });
        
        sortedProducts.forEach(p => {
          const row = summarySheet.addRow([p.name, p.qty]);
          row.eachCell(cell => {
            cell.border = {
              top: { style: 'thin' }, left: { style: 'thin' },
              bottom: { style: 'thin' }, right: { style: 'thin' }
            };
          });
        });

        // Format Summary Sheet
        summarySheet.getColumn(1).width = 40;
        summarySheet.getColumn(2).width = 25;

        // Worksheet 2: Detail Transaksi
        const detailSheet = workbook.addWorksheet('Detail Transaksi');
        const headerRow = detailSheet.addRow([
          'Tanggal & Waktu', 'No. Pesanan', 'Detail Pesanan', 'Qty', 'Harga Satuan', 
          'Subtotal', 'Total Belanja', 'Metode Pembayaran', 'Uang Diterima', 'Kembalian'
        ]);
        
        headerRow.font = { bold: true };
        headerRow.eachCell(cell => {
          cell.border = {
            top: { style: 'thin' }, left: { style: 'thin' },
            bottom: { style: 'thin' }, right: { style: 'thin' }
          };
        });

        detailedTx.forEach(tx => {
          const txDate = new Date(tx.date).toLocaleString('id-ID');
          const methodStr = (tx.payment_method || 'cash').toUpperCase();

          if (tx.items && tx.items.length > 0) {
            tx.items.forEach((item, index) => {
              const subtotal = item.price * item.quantity;
              let row;
              if (index === 0) {
                row = detailSheet.addRow([
                  txDate, tx.id, item.productName || 'Unknown', item.quantity, item.price, 
                  subtotal, tx.total, methodStr, tx.payment || 0, tx.change || 0
                ]);
                row.eachCell(cell => {
                  cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE2EFDA' }
                  };
                });
              } else {
                row = detailSheet.addRow([
                  '', '', item.productName || 'Unknown', item.quantity, item.price, 
                  subtotal, '', '', '', ''
                ]);
              }
              row.eachCell(cell => {
                cell.border = {
                  top: { style: 'thin' }, left: { style: 'thin' },
                  bottom: { style: 'thin' }, right: { style: 'thin' }
                };
              });
            });
          } else {
            // Edge case: no items
            const row = detailSheet.addRow([
              txDate, tx.id, '(no items)', '', '', 
              '', tx.total, methodStr, tx.payment || 0, tx.change || 0
            ]);
            row.eachCell(cell => {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE2EFDA' }
              };
              cell.border = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' }
              };
            });
          }
        });

        detailSheet.getColumn(1).width = 20;
        detailSheet.getColumn(2).width = 15;
        detailSheet.getColumn(3).width = 25;
        detailSheet.getColumn(4).width = 10;
        detailSheet.getColumn(5).width = 15;
        detailSheet.getColumn(6).width = 15;
        detailSheet.getColumn(7).width = 20;
        detailSheet.getColumn(8).width = 15;
        detailSheet.getColumn(9).width = 15;
        detailSheet.getColumn(10).width = 15;

        const buffer = await workbook.xlsx.writeBuffer();

        if (Capacitor.isNativePlatform()) {
          try {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
              binary += String.fromCharCode(bytes[i]);
            }
            const base64Data = window.btoa(binary);

            // Save to Cache to bypass Android 13+ storage restrictions
            const writeResult = await Filesystem.writeFile({
              path: fileName,
              data: base64Data,
              directory: Directory.Cache
            });
            
            // --- Silent Save to Documents with Seatbelt ---
            try {
              const safeShopName = (localStorage.getItem('shopName') || 'Kedai').replace(/[^a-zA-Z0-9]/g, '_');
              const autoSaveFileName = `Laporan_${safeShopName}_${fileName.replace('Laporan_Penjualan_', '')}`;
              
              await Filesystem.writeFile({
                path: autoSaveFileName,
                data: base64Data,
                directory: Directory.Documents
              });
              console.log("Auto-save to Documents successful:", autoSaveFileName);
            } catch (silentError) {
              console.log("Auto-save to Documents failed, proceeding with Share fallback:", silentError);
            }
            // ----------------------------------------------
            
            // Trigger native Share/Save menu
            await Share.share({
              url: writeResult.uri,
              title: reportLabel,
              dialogTitle: 'Bagikan atau Simpan Laporan Excel'
            });
            
            toast.success('Laporan siap dibagikan (Otomatis tersimpan di Documents jika diizinkan perangkat)');
            setShowExportModal(false);
          } catch (nativeError) {
            console.error("Native file saving error:", nativeError);
            toast.error('Gagal membagikan laporan Excel.');
          }
        } else {
          saveAs(new Blob([buffer]), fileName);
          toast.success('Laporan Excel berhasil diunduh dan disimpan');
          setShowExportModal(false);
        }
      } catch (fileError) {
        console.error("File creation error:", fileError);
        toast.error('Gagal membuat file Excel.');
      }
    } catch (globalError) {
      console.error("Global Excel Export Error:", globalError);
      toast.error('Gagal mengekspor laporan: ' + globalError.message);
    }
  };

  const exportToPDF = async () => {
    try {
      let detailedTx;
      let reportLabel;
      let fileName;

      try {
        if (reportMode === 'daily') {
          if (!selectedDate) {
            toast.error('Please select a date first.');
            return;
          }
          reportLabel = new Date(selectedDate).toLocaleDateString('id-ID');
          fileName = `Laporan_Penjualan_${selectedDate}.pdf`;
          detailedTx = await transactionModel.getDetailedTransactionsByDate(selectedDate);
        } else {
          const monthIndex = parseInt(exportMonth, 10);
          reportLabel = `${monthNames[monthIndex]} ${exportYear}`;
          fileName = `Laporan_Penjualan_${monthNames[monthIndex]}_${exportYear}.pdf`;
          detailedTx = await transactionModel.getDetailedTransactionsByMonth(exportYear, monthIndex);
        }
      } catch (dbError) {
        console.error("Database error during export:", dbError);
        toast.error(`Failed to read data: ${dbError.message || 'Database error'}`);
        return;
      }

      if (!detailedTx || detailedTx.length === 0) {
        toast.error("Tidak ada transaksi pada periode yang dipilih");
        return;
      }

      try {
        const summaryData = calculateReportSummary(detailedTx);
        const { totalTransaksi, totalItemsSold, paymentSummary, totalOmzet, sortedProducts } = summaryData;

        // 1. Setup Dokumen
        const doc = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'mm' });
        
        // 3. Header Dokumen
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.text('LAPORAN PENJUALAN MYTEA', 15, 15);
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Periode: ${reportLabel}`, 15, 22);
        doc.text(`Waktu Dicetak: ${new Date().toLocaleString('id-ID')}`, 15, 29);

        // 4. Tabel 1 (Ringkasan Finansial)
        const formatRp = (amount) => `Rp ${amount.toLocaleString('id-ID')}`;
        
        const summaryBody = [
          ['Total Transaksi', totalTransaksi],
          ['Total Item Terjual', totalItemsSold],
          ['Total Pendapatan Tunai (CASH)', formatRp(paymentSummary['CASH'] || 0)],
          ['Total Pendapatan Non-Tunai (QRIS)', formatRp(paymentSummary['QRIS'] || 0)],
          ['TOTAL OMZET', formatRp(totalOmzet)]
        ];

        autoTable(doc, {
          startY: 35,
          margin: { left: 15, right: 15 },
          head: [['Ringkasan', 'Nilai']],
          body: summaryBody,
          theme: 'grid',
          headStyles: { fillColor: [173, 216, 230], textColor: [0, 0, 0] }, // biru muda
          styles: { fontStyle: 'bold' }
        });

        // 4.5. Tabel Rekapitulasi Produk
        const rekapBody = sortedProducts.map(p => [p.name, p.qty]);
        
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 10,
          margin: { left: 15, right: 15 },
          head: [['Nama Menu', 'Jumlah Terjual']],
          body: rekapBody,
          theme: 'grid',
          headStyles: { fillColor: [128, 128, 128], textColor: [255, 255, 255] } // abu-abu
        });

        // 5. Tabel 2 (Detail Transaksi)
        const detailHead = [[
          'Tanggal & Waktu', 'No. Pesanan', 'Detail Pesanan', 'Qty', 'Harga Satuan', 
          'Subtotal', 'Total Belanja', 'Metode Pembayaran', 'Uang Diterima', 'Kembalian'
        ]];

        const detailBody = [];
        detailedTx.forEach(tx => {
          const txDate = new Date(tx.date).toLocaleString('id-ID');
          const methodStr = (tx.payment_method || 'cash').toUpperCase();

          if (tx.items && tx.items.length > 0) {
            tx.items.forEach((item, index) => {
              const subtotal = item.price * item.quantity;
              if (index === 0) {
                detailBody.push([
                  txDate, tx.id.toString(), item.productName || 'Unknown', item.quantity, item.price, 
                  subtotal, tx.total, methodStr, tx.payment || 0, tx.change || 0
                ]);
              } else {
                detailBody.push([
                  '', '', item.productName || 'Unknown', item.quantity, item.price, 
                  subtotal, '', '', '', ''
                ]);
              }
            });
          } else {
            detailBody.push([
              txDate, tx.id.toString(), '(no items)', '', '', 
              '', tx.total, methodStr, tx.payment || 0, tx.change || 0
            ]);
          }
        });

        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 10,
          margin: { left: 15, right: 15 },
          head: detailHead,
          body: detailBody,
          theme: 'grid',
          headStyles: { fillColor: '#E2EFDA', textColor: [0, 0, 0] }, // hijau muda
          styles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 25 },
            2: { cellWidth: 'auto' }
          },
          showHead: 'everyPage'
        });

        // Loop Penomoran Halaman
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(10);
          doc.setTextColor(100);
          const text = `Halaman ${i} dari ${pageCount}`;
          const xPos = doc.internal.pageSize.getWidth() - 15;
          const yPos = doc.internal.pageSize.getHeight() - 10;
          doc.text(text, xPos, yPos, { align: 'right' });
        }

        // 6. Bypass Scoped Storage (Native Export)
        if (Capacitor.isNativePlatform()) {
          try {
            const pdfOutput = doc.output('datauristring');
            const base64Data = pdfOutput.split(',')[1];

            const safeShopName = (localStorage.getItem('shopName') || 'Kedai').replace(/[^a-zA-Z0-9]/g, '_');
            const autoSaveFileName = `Laporan_${safeShopName}_${fileName.replace('Laporan_Penjualan_', '')}`;

            // Save to Cache for sharing
            const writeResult = await Filesystem.writeFile({
              path: fileName,
              data: base64Data,
              directory: Directory.Cache
            });
            
            // Silent Save to Documents
            try {
              await Filesystem.writeFile({
                path: autoSaveFileName,
                data: base64Data,
                directory: Directory.Documents
              });
            } catch (silentError) {
              console.log("Auto-save to Documents failed:", silentError);
            }
            
            // Trigger native Share/Save menu
            await Share.share({
              url: writeResult.uri,
              title: reportLabel,
              dialogTitle: 'Bagikan atau Simpan Laporan PDF'
            });
            
            toast.success('Laporan siap dibagikan (Otomatis tersimpan di Documents jika diizinkan perangkat)');
            setShowExportModal(false);
          } catch (nativeError) {
            console.error("Native file saving error:", nativeError);
            toast.error('Gagal membagikan laporan PDF.');
          }
        } else {
          doc.save(fileName);
          toast.success('Laporan PDF berhasil diunduh');
          setShowExportModal(false);
        }
      } catch (fileError) {
        console.error("File creation error:", fileError);
        alert("Error PDF: " + (fileError.message || JSON.stringify(fileError)));
      }
    } catch (globalError) {
      console.error("Global PDF Export Error:", globalError);
      alert("Error PDF: " + (globalError.message || JSON.stringify(globalError)));
    }
  };

  return (
    <div className="report-container">
      <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
        <h1 className="header-title" style={{ margin: 0 }}>Laporan Penjualan</h1>
        <button className="btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: '14px' }} onClick={() => setShowExportModal(true)}>
          Unduh Laporan
        </button>
      </div>

      <div className="summary-cards">
        <div className="summary-card primary">
          <h3>Pendapatan Hari Ini</h3>
          <h2>Rp {todaysSales.toLocaleString('id-ID')}</h2>
        </div>
        <div className="summary-card secondary">
          <h3>Total Bulan Ini</h3>
          <h2>Rp {totalThisMonth.toLocaleString('id-ID')}</h2>
        </div>
      </div>

      {/* Cloud Sync Banner */}
      <button
        onClick={handleSyncToCloud}
        disabled={pendingSyncs.length === 0 || isSyncing}
        style={{
          width: '100%',
          padding: '12px 16px',
          marginBottom: 0,
          borderRadius: '10px',
          border: 'none',
          cursor: pendingSyncs.length > 0 && !isSyncing ? 'pointer' : 'not-allowed',
          fontWeight: 600,
          fontSize: '14px',
          transition: 'opacity 0.2s',
          backgroundColor: pendingSyncs.length > 0 ? '#3b82f6' : '#e5e7eb',
          color: pendingSyncs.length > 0 ? '#ffffff' : '#9ca3af',
          opacity: isSyncing ? 0.7 : 1
        }}
      >
        {isSyncing
          ? 'Menyinkronkan...'
          : pendingSyncs.length > 0
            ? `☁️ Sinkronkan ${pendingSyncs.length} Transaksi ke Cloud`
            : '✓ Semua data tersinkronisasi'
        }
      </button>

      <div className="transaction-history">
        <h2 className="section-title">Transaksi Terbaru</h2>
        {recentTransactions.length === 0 ? (
          <p className="empty-state">Belum ada transaksi.</p>
        ) : (
          <div className="transaction-list">
            {recentTransactions.map(tx => (
              <div key={tx.id} className="transaction-card" onClick={() => handleTxClick(tx)} style={{ cursor: 'pointer' }}>
                <div className="tx-header">
                  <span className="tx-id">Order #{tx.id}</span>
                  <span className="tx-date">{new Date(tx.date).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit'})}</span>
                </div>
                <div className="tx-details">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="tx-total">Rp {tx.total.toLocaleString('id-ID')}</span>
                    {tx.payment_method && (
                      <span className={`tx-method-badge ${tx.payment_method}`}>
                        {tx.payment_method.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="tx-status">Selesai</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTx && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 className="modal-title" style={{ margin: 0 }}>Order #{selectedTx.id}</h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--text-light)' }}>&times;</button>
            </div>
            
            <div style={{ marginBottom: 16, borderBottom: '1px solid #eee', paddingBottom: 16 }}>
              <p style={{ fontSize: 14, color: 'var(--text-light)', marginBottom: 12 }}>{new Date(selectedTx.date).toLocaleString('id-ID')}</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {txDetails.map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 600, whiteSpace: 'normal', overflowWrap: 'break-word', wordBreak: 'break-all', hyphens: 'auto' }}>{item.productName}</span>
                      <span style={{ color: 'var(--text-light)', fontSize: 13, marginLeft: 8, flexShrink: 0 }}>x{item.quantity}</span>
                    </div>
                    <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>Rp {(item.price * item.quantity).toLocaleString('id-ID')}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
                <span>Total</span>
                <span style={{ color: 'var(--primary-color)' }}>Rp {selectedTx.total.toLocaleString('id-ID')}</span>
              </div>
              
              <div className="report-modal-row">
                <span>Metode Pembayaran</span>
                <span className={`modal-method-text ${selectedTx.payment_method === 'qris' ? 'qris' : 'cash'}`}>
                  {selectedTx.payment_method === 'qris' ? 'QRIS' : 'CASH'}
                </span>
              </div>

              {selectedTx.payment_method !== 'qris' && (
                <>
                  <div className="report-modal-row">
                    <span>Uang Diterima</span>
                    <span>Rp {selectedTx.payment.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="report-modal-row">
                    <span>Kembalian</span>
                    <span>Rp {selectedTx.change.toLocaleString('id-ID')}</span>
                  </div>
                </>
              )}
            </div>
            
            <button 
              className="btn-primary" 
              onClick={handlePrintReceipt}
              disabled={isPrinting}
              style={{ width: '100%', marginTop: '20px', padding: '14px', fontSize: '16px' }}
            >
              {isPrinting ? 'Mencetak...' : 'Cetak Ulang Struk'}
            </button>
          </div>
        </div>
      )}

      {showExportModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 className="modal-title">Unduh Laporan</h2>
            
            <div className="report-mode-tabs">
              <button 
                className={`report-tab-btn ${reportMode === 'daily' ? 'active' : ''}`}
                onClick={() => setReportMode('daily')}
              >
                Laporan Harian
              </button>
              <button 
                className={`report-tab-btn ${reportMode === 'monthly' ? 'active' : ''}`}
                onClick={() => setReportMode('monthly')}
              >
                Laporan Bulanan
              </button>
            </div>

            {reportMode === 'daily' ? (
              <div className="form-group" style={{ marginBottom: '24px' }}>
                <label>Pilih Tanggal</label>
                <input 
                  type="date" 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)} 
                  className="export-select"
                />
              </div>
            ) : (
              <>
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label>Pilih Tahun</label>
                  <select value={exportYear} onChange={(e) => setExportYear(parseInt(e.target.value))} className="export-select">
                    {[new Date().getFullYear(), new Date().getFullYear() - 1].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: '24px' }}>
                  <label>Pilih Bulan</label>
                  <select value={exportMonth} onChange={(e) => setExportMonth(e.target.value)} className="export-select">
                    {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                      <option key={m} value={i}>{m}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="modal-actions" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                className="btn-secondary" 
                style={{ width: '100%', backgroundColor: '#2563EB', color: 'white', border: 'none' }} 
                onClick={handleExportDrive}
                disabled={isUploadingToDrive}
              >
                {isUploadingToDrive ? 'Mengunggah...' : 'Simpan ke Drive'}
              </button>
              <button 
                className="btn-secondary" 
                style={{ width: '100%', backgroundColor: '#16A34A', color: 'white', border: 'none' }} 
                onClick={handleExportExcel}
              >
                Unduh Excel
              </button>
              <button 
                className="btn-secondary" 
                style={{ width: '100%', backgroundColor: '#DC2626', color: 'white', border: 'none' }} 
                onClick={exportToPDF}
              >
                Unduh PDF
              </button>
              <button 
                className="btn-secondary" 
                style={{ width: '100%', backgroundColor: 'transparent', color: 'red', border: 'none' }} 
                onClick={() => setShowExportModal(false)}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Report;
