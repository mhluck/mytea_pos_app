import { db } from './db';
import { productModel } from './product_model';

export const transactionModel = {
  // Process a completely new checkout transaction
  processCheckout: async (cartItems, total, payment, method = 'cash') => {
    return await db.transaction('rw', db.transactions, db.transaction_items, db.products, async () => {
      const change = payment - total;
      
      // 1. Create the transaction record
      const transactionId = await db.transactions.add({
        date: new Date().toISOString(),
        total: total,
        payment: payment,
        change: change,
        payment_method: method || 'cash',
        is_synced: false
      });

      // 2. Create transaction items and deduct stock
      for (const item of cartItems) {
        await db.transaction_items.add({
          transaction_id: transactionId,
          product_id: item.id,
          quantity: item.quantity,
          price: item.price
        });

        // 3. Update stock
        await productModel.deductStock(item.id, item.quantity);
      }

      return { transactionId, change };
    });
  },

  // Get today's total sales
  getTodaysTotalSales: async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    const transactions = await db.transactions
      .filter(tx => new Date(tx.date) >= today)
      .toArray();

    return transactions.reduce((sum, tx) => sum + tx.total, 0);
  },

  // Get total order count today
  getTodaysOrderCount: async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return await db.transactions
      .filter(tx => new Date(tx.date) >= today)
      .count();
  },

  // Get all transactions
  getAllTransactions: async () => {
    return await db.transactions.orderBy('date').reverse().toArray();
  },

  // Get recent transactions (last 2 days)
  getRecentTransactions: async () => {
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(today.getDate() - 2);
    twoDaysAgo.setHours(0, 0, 0, 0);

    const transactions = await db.transactions
      .filter(tx => new Date(tx.date) >= twoDaysAgo)
      .toArray();
      
    return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  // Get this month's total sales
  getThisMonthTotalSales: async () => {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const transactions = await db.transactions
      .filter(tx => new Date(tx.date) >= firstDayOfMonth)
      .toArray();

    return transactions.reduce((sum, tx) => sum + tx.total, 0);
  },

  // Get transaction details with product names
  getTransactionDetails: async (transactionId) => {
    const items = await db.transaction_items
      .filter(item => item.transaction_id === transactionId)
      .toArray();
    
    const enrichedItems = await Promise.all(items.map(async item => {
      const product = await db.products.get(item.product_id);
      return {
        ...item,
        productName: product ? product.name : 'Unknown Product'
      };
    }));
    
    return enrichedItems;
  },

  // Get detailed transactions for a specific month and year
  getDetailedTransactionsByMonth: async (year, month) => {
    // NOTE: Dexie cannot chain .orderBy() after .filter(), so we sort in JS
    const allTransactions = await db.transactions.toArray();
    const transactions = allTransactions
      .filter(tx => {
        const txDate = new Date(tx.date);
        return txDate.getFullYear() === year && txDate.getMonth() === month;
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Enrich transactions with items
    const enrichedTransactions = await Promise.all(transactions.map(async tx => {
      const details = await transactionModel.getTransactionDetails(tx.id);
      return {
        ...tx,
        items: details
      };
    }));

    return enrichedTransactions;
  },

  // Get detailed transactions for a specific date (YYYY-MM-DD)
  getDetailedTransactionsByDate: async (dateString) => {
    const allTransactions = await db.transactions.toArray();
    const transactions = allTransactions
      .filter(tx => tx.date.startsWith(dateString))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Enrich transactions with items
    const enrichedTransactions = await Promise.all(transactions.map(async tx => {
      const details = await transactionModel.getTransactionDetails(tx.id);
      return {
        ...tx,
        items: details
      };
    }));

    return enrichedTransactions;
  }
};
