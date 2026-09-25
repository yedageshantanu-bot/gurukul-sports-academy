import { PaymentProvider } from './paymentProvider.interface.js';
import { MockPaymentProvider } from './mockPaymentProvider.js';
import { RazorpayPaymentProvider } from './razorpayPaymentProvider.js';

class PaymentProviderFactory {
  private mockProvider = new MockPaymentProvider();
  private razorpayProvider = new RazorpayPaymentProvider();

  getProvider(providerType?: 'RAZORPAY' | 'MOCK' | 'MANUAL'): PaymentProvider {
    if (providerType === 'RAZORPAY') {
      if (this.razorpayProvider.isConfigured()) {
        return this.razorpayProvider;
      }
      // If Razorpay requested but credentials not present, log notice and return mock in dev
      console.warn('[PaymentProviderFactory] Razorpay requested but credentials not present. Using MOCK provider.');
      return this.mockProvider;
    }

    // Default to Mock provider
    return this.mockProvider;
  }
}

export const paymentProviderFactory = new PaymentProviderFactory();
