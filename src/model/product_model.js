import { db } from './db';

export const productModel = {
  // Get all products
  getAllProducts: async () => {
    return await db.products.toArray();
  },

  // Add a new product
  addProduct: async (product) => {
    return await db.products.add(product);
  },

  // Update a product
  updateProduct: async (id, changes) => {
    return await db.products.update(id, changes);
  },

  // Delete a product
  deleteProduct: async (id) => {
    return await db.products.delete(id);
  },

  // Deduct stock after a transaction
  deductStock: async (productId, quantity) => {
    const product = await db.products.get(productId);
    if (product) {
      const newStock = Math.max(0, product.stock - quantity);
      await db.products.update(productId, { stock: newStock });
    }
  }
};
