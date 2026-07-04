import { SubscriptionService } from './SubscriptionService';

export class PermissionService {
  /**
   * Resolves whether the target shop is authorized to access a given system feature.
   * e.g. code: "MOBILE_APP"
   */
  static async canAccessFeature(shopId: string, featureCode: string): Promise<boolean> {
    // Allows bypassing system admin shop checks automatically
    if (shopId === 'admin-system-shop-id') {
      return true;
    }
    return SubscriptionService.canUseFeature(shopId, featureCode);
  }

  /**
   * Resolves whether a shop fits the plan quota limits.
   * e.g. limitType: "PRODUCTS"
   */
  static async isWithinLimit(shopId: string, limitType: string, currentCount: number): Promise<boolean> {
    if (shopId === 'admin-system-shop-id') {
      return true;
    }
    return SubscriptionService.checkLimit(shopId, limitType, currentCount);
  }
}
