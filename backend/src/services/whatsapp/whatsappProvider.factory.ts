import { env } from '../../config/env.js';
import { WhatsAppSender } from './whatsappProvider.interface.js';
import { MockWhatsAppProvider } from './mockWhatsAppProvider.js';
import { MetaWhatsAppProvider } from './metaWhatsAppProvider.js';
import { PrototypeLinkedDeviceSender } from './prototypeLinkedDeviceSender.js';
import { openWaProvider, OpenWaProvider } from './openWaProvider.js';
import { BaileysWhatsAppProvider } from './baileysConnectionManager.js';

class WhatsAppProviderFactory {
  private mockProvider = new MockWhatsAppProvider();
  private metaProvider = new MetaWhatsAppProvider();
  private prototypeSender = new PrototypeLinkedDeviceSender();
  private openWaProvider = openWaProvider;
  private baileysProvider = new BaileysWhatsAppProvider();

  getProvider(providerType?: 'mock' | 'prototype_linked_device' | 'meta' | 'openwa' | 'baileys' | string): WhatsAppSender {
    const selected = (providerType || env.WHATSAPP_PROVIDER || 'openwa').toLowerCase().trim();

    if (selected === 'mock') {
      return this.mockProvider;
    }

    if (selected === 'meta') {
      if (this.metaProvider.isConfigured()) {
        return this.metaProvider;
      }
    }

    if (selected === 'prototype_linked_device' || selected === 'linked_device' || selected === 'prototype') {
      return this.prototypeSender;
    }

    if (selected === 'baileys') {
      return this.baileysProvider;
    }

    if (selected === 'openwa' || selected === 'open-wa' || selected === 'open_wa') {
      return this.openWaProvider;
    }

    // Default to OpenWA if configured, otherwise fallback to mock
    if (this.openWaProvider.isConfigured()) {
      return this.openWaProvider;
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

  getBaileysProvider(): BaileysWhatsAppProvider {
    return this.baileysProvider;
  }
}

export const whatsappProviderFactory = new WhatsAppProviderFactory();
