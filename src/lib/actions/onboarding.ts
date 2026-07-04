'use server';

import { prisma } from '@/db/prisma';
import { BusinessType, Role, SubscriptionStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { validatePassword } from '@/lib/passwordPolicy';

interface OnboardingInput {
  shopName: string;
  ownerName: string;
  mobile: string;
  email?: string;
  passwordInput: string;
  businessType: BusinessType;
}

export async function createShopOnboardingAction(data: OnboardingInput) {
  try {
    const { shopName, ownerName, mobile, email, passwordInput, businessType } = data;

    // Validate password complexity
    const passwordValidation = validatePassword(passwordInput, {
      minPasswordLength: 8,
      requirePasswordUppercase: true,
      requirePasswordNumber: true,
      requirePasswordSpecial: false
    });
    if (!passwordValidation.isValid) {
      return { success: false, error: passwordValidation.error };
    }

    // 1. Check if mobile already registered
    const existingUser = await prisma.user.findUnique({
      where: { mobile }
    });

    if (existingUser) {
      return {
        success: false,
        error: 'ਇਹ ਮੋਬਾਈਲ ਨੰਬਰ ਪਹਿਲਾਂ ਹੀ ਰਜਿਸਟਰਡ ਹੈ (This mobile number is already registered)'
      };
    }

    // 2. Fetch default Basic Plan for Trial subscription assignment
    const defaultPlan = await prisma.plan.findFirst({
      where: { name: 'Basic Plan', isActive: true }
    });

    if (!defaultPlan) {
      return {
        success: false,
        error: 'ਸਿਸਟਮ ਸੰਰਚਨਾ ਤਰੁੱਟੀ: ਕੋਈ ਮੂਲ ਪਲਾਨ ਨਹੀਂ ਮਿਲਿਆ (System configuration error: Default plan not found. Please seed first.)'
      };
    }

    const hashedPassword = await bcrypt.hash(passwordInput, 10);

    // 3. Start Database Transaction
    const result = await prisma.$transaction(async (tx) => {
      // A. Create Shop
      const shop = await tx.shop.create({
        data: {
          name: shopName,
          businessType,
          address: '',
          phone: mobile,
          email: email || '',
          currency: 'INR'
        }
      });

      // B. Create Owner User
      const user = await tx.user.create({
        data: {
          mobile,
          name: ownerName,
          password: hashedPassword,
          role: Role.OWNER,
          shopId: shop.id
        }
      });

      // C. Create default Settings
      await tx.settings.create({
        data: {
          shopId: shop.id,
          language: 'pa',
          theme: 'light',
          receiptPrefix: 'RCP-',
          taxPrefix: 'INV-'
        }
      });

      // D. Setup 14-day Trial Subscription
      const trialDuration = 14; // 14 days trial
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + trialDuration);

      await tx.subscription.create({
        data: {
          shopId: shop.id,
          planId: defaultPlan.id,
          status: SubscriptionStatus.TRIAL,
          startDate,
          endDate,
          trialEndsAt: endDate
        }
      });

      // E. Log Onboarding Subscription History
      await tx.subscriptionHistory.create({
        data: {
          shopId: shop.id,
          planId: defaultPlan.id,
          status: SubscriptionStatus.TRIAL,
          startDate,
          endDate,
          reason: 'Self-service signup trial activated',
          changedByUserId: user.id
        }
      });

      // F. Seed Business-specific Categories
      let categoriesToSeed = ['General (ਆਮ)', 'Miscellaneous (ਫੁਟਕਲ)'];
      if (businessType === BusinessType.GROCERY || businessType === BusinessType.GENERAL_STORE) {
        categoriesToSeed = [
          'Beverages (ਕੋਲਡ ਡਰਿੰਕਸ)',
          'Snacks (ਸਨੈਕਸ)',
          'Dairy (ਡੇਅਰੀ)',
          'Spices (ਮਸਾਲੇ)',
          'Grains (ਅਨਾਜ)',
          'Bakery (ਬੇਕਰੀ)'
        ];
      } else if (businessType === BusinessType.MEDICAL) {
        categoriesToSeed = [
          'Tablets (ਗੋਲੀਆਂ)',
          'Capsules (ਕੈਪਸੂਲ)',
          'Syrups (ਸਿਰਪ)',
          'Injections (ਟੀਕੇ)',
          'Ointments (ਮਲ੍ਹਮਾਂ)'
        ];
      } else if (businessType === BusinessType.GARMENTS) {
        categoriesToSeed = [
          'Shirts (ਕਮੀਜ਼ਾਂ)',
          'Pants (ਪੈਂਟਾਂ)',
          'Traditional Wear (ਕੁੜਤਾ-ਪਜਾਮਾ)',
          'Winter Wear (ਗਰਮ ਕੱਪੜੇ)'
        ];
      }

      for (const catName of categoriesToSeed) {
        await tx.category.create({
          data: {
            name: catName,
            shopId: shop.id
          }
        });
      }

      // G. Log central AuditLog
      await tx.auditLog.create({
        data: {
          shopId: shop.id,
          userId: user.id,
          action: 'Created Shop',
          module: 'SaaS',
          entity: 'Shop',
          details: `Shop "${shopName}" onboarded with trial active until ${endDate.toLocaleDateString()}.`
        }
      });

      return { shop, user };
    });

    return { success: true, shopId: result.shop.id };
  } catch (err: any) {
    console.error('Shop Onboarding Error:', err);
    return { success: false, error: 'ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਦੌਰਾਨ ਤਰੁੱਟੀ ਆਈ (An error occurred during onboarding)' };
  }
}
