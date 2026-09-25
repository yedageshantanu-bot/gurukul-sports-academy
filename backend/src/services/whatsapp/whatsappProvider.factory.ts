import { env } from '../../config/env.js';
import { WhatsAppSender } from './whatsappProvider.interface.js';
import { MockWhatsAppProvider } from './mockWhatsAppProvider.js';
import { MetaWhatsAppProvider } from './metaWhatsAppProvider.js';
import { PrototypeLinkedDeviceSender } from './prototypeLinkedDeviceSender.js';
import { openWaProvider, OpenWaProvider } from './openWaProvider.js';

class WhatsAppProviderFactory {
  private mockProvider = new MockWhatsAppProvider();
  private metaProvider = new MetaWhatsAppProvider();
  private prototypeSender = new PrototypeLinkedDeviceSender();
  private openWaProvider = openWaProvider;

  getProvider(providerType?: 'mock' | 'prototype_linked_device' | 'meta' | 'openwa' | string): WhatsAppSender {
    const selected = (providerType || env.WHATSAPP_PROVIDER || 'mock').toLowerCase().trim();

    if (selected === 'openwa' || selected === 'open-wa' || selected === 'open_wa') {
      return this.openWaProvider;
    }

    if (selected === 'prototype_linked_device' || selected === 'linked_device' || selected === 'prototype') {
      return this.prototypeSender;
    }

    if (selected === 'meta') {
      if (this.metaProvider.isConfigured()) {
        return this.metaProvider;
      }
      console.warn(
        '[WhatsAppProviderFactory] Meta WhatsApp requested but credentials are not configured. Falling back to MOCK provider.'
      );
      return this.mockProvider;
    }

    return this.mockProvider;
  }

  getOpenWaProvider(): OpenWaProvider {
    return this.openWaProvider;
  }

  getPrototypeSender(): PrototypeLinkedDeviceSender {
    return this.prototypeSender;
  }

  getMockProvider(): MockWhatsAppProvider {
    return this.mockProvider;
  }

  getMetaProvider(): MetaWhatsAppProvider {
    return this.metaProvider;
  }
}

export const whatsappProviderFactory = new WhatsAppProviderFactory();
