import Dexie from 'dexie';

export const db = new Dexie('KedaiEsTehDB');

// Define database schema
db.version(1).stores({
  products: '++id, name, price, stock', // primary key is id (auto-incremented)
  transactions: '++id, date, total, payment, change',
  transaction_items: '++id, transaction_id, product_id, quantity, price'
});

db.version(2).stores({
  products: '++id, name, category, price, stock'
});

// Populate some initial products if db is empty for testing UI
db.on('populate', () => {
  db.products.bulkAdd([
    { name: 'Green Tea', category: 'Classic', price: 10000, stock: 50 },
    { name: 'Thai Tea', category: 'Milk Tea', price: 12000, stock: 45 },
    { name: 'Lemon Tea', category: 'Classic', price: 8000, stock: 60 }
  ]);
});
