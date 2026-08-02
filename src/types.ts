export interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  minStockAlert: number;
  category: string;
  unit: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  totalAmount: number;
  paymentMethod: 'cash' | 'credit';
  createdBy: string;
  createdAt: string;
}

export interface UserRole {
  role: 'admin' | 'staff';
  name?: string;
  email?: string;
}
