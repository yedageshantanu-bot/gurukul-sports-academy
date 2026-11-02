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
    const selected = (providerType || env.WHATSAPP_PROVIDER || 'openwa').toLowerCase().trim();

    if (selected === 'meta') {
      if (this.metaProvider.isConfigured()) {
        return this.metaProvider;
      }
    }

    if (selected === 'prototype_linked_device' || selected === 'linked_device' || selected === 'prototype') {
      return this.prototypeSender;
    }

    // Always prefer OpenWA bridge when available or configured
    if (this.openWaProvider.isConfigured() || selected === 'openwa' || selected === 'open-wa' || selected === 'open_wa') {
      return this.openWaProvider;
    }

    if (selected === 'mock') {
      return this.mockProvider;
    }

    return this.openWaProvider;
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
