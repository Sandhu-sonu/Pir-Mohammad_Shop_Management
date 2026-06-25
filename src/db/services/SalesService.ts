import { SalesRepository, CreateSaleInput } from '../repositories/SalesRepository';

export class SalesService {
  static async getSale(id: string) {
    return SalesRepository.findById(id);
  }

  static async getSaleByInvoice(invoiceNumber: string) {
    return SalesRepository.findByInvoiceNumber(invoiceNumber);
  }

  static async listSales(shopId: string, page = 1, limit = 10) {
    return SalesRepository.findAll(shopId, page, limit);
  }

  static async createSale(data: CreateSaleInput) {
    if (!data.items || data.items.length === 0) {
      throw new Error('No items in the cart');
    }

    for (const item of data.items) {
      if (item.quantity <= 0) {
        throw new Error('Quantity must be greater than zero');
      }
      if (item.sellingPrice < 0) {
        throw new Error('Selling price cannot be negative');
      }
    }

    if (data.discount < 0) {
      throw new Error('Discount cannot be negative');
    }

    return SalesRepository.create(data);
  }

  static async reverseSale(saleId: string, userId?: string) {
    return SalesRepository.reverse(saleId, userId);
  }
}
