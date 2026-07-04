import { prisma } from '../prisma';
import { SubscriptionStatus } from '@prisma/client';

export class SubscriptionService {
  /**
   * Evaluates if a specific feature is enabled under the shop's active subscription.
   * e.g. code: "MOBILE_APP"
   */
  static async canUseFeature(shopId: string, featureCode: string): Promise<boolean> {
    try {
      const sub = await prisma.subscription.findUnique({
        where: { shopId },
        include: {
          plan: {
            include: {
              features: {
                include: { feature: true }
              }
            }
          }
        }
      });

      if (!sub || sub.status === SubscriptionStatus.EXPIRED || sub.status === SubscriptionStatus.SUSPENDED) {
        return false;
      }

      // Check date bounds
      if (new Date() > new Date(sub.endDate)) {
        // Auto mark as expired if date is past
        await prisma.subscription.update({
          where: { shopId },
          data: { status: SubscriptionStatus.EXPIRED }
        });
        return false;
      }

      const planFeat = sub.plan.features.find((f) => f.feature.code === featureCode);
      return planFeat ? planFeat.enabled : false;
    } catch (err) {
      console.error('SubscriptionService canUseFeature Error:', err);
      return false;
    }
  }

  /**
   * Checks if the shop satisfies the quantitative limit for a specific feature.
   * e.g. limitType: "USERS" or "PRODUCTS"
   * Returns true if currentCount is strictly LESS than the plan's limitValue.
   */
  static async checkLimit(shopId: string, limitType: string, currentCount: number): Promise<boolean> {
    try {
      const sub = await prisma.subscription.findUnique({
        where: { shopId },
        include: {
          plan: {
            include: {
              features: {
                include: { feature: true }
              }
            }
          }
        }
      });

      if (!sub || sub.status === SubscriptionStatus.EXPIRED || sub.status === SubscriptionStatus.SUSPENDED) {
        return false;
      }

      // Check date bounds
      if (new Date() > new Date(sub.endDate)) {
        return false;
      }

      const planFeat = sub.plan.features.find((f) => f.limitType === limitType);
      if (!planFeat) return true; // No limit mapping means unlimited

      if (!planFeat.enabled) return false;
      return currentCount < planFeat.limitValue;
    } catch (err) {
      console.error('SubscriptionService checkLimit Error:', err);
      return false;
    }
  }

  /**
   * Logs a subscription transition in historical tracking.
   */
  static async logPlanTransition(
    shopId: string,
    planId: string,
    status: SubscriptionStatus,
    changedByUserId?: string,
    reason?: string
  ): Promise<void> {
    try {
      const sub = await prisma.subscription.findUnique({
        where: { shopId }
      });

      const startDate = sub?.startDate || new Date();
      const endDate = sub?.endDate || new Date();

      await prisma.subscriptionHistory.create({
        data: {
          shopId,
          planId,
          status,
          startDate,
          endDate,
          changedByUserId: changedByUserId || null,
          reason: reason || null
        }
      });
    } catch (err) {
      console.error('SubscriptionService logPlanTransition Error:', err);
    }
  }
}
