import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildTestApp, mockPrisma } from './helpers.js';

describe('Kajabi Webhook Routes', () => {
  let app;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Reset all mocks
    for (const model of Object.values(mockPrisma)) {
      if (typeof model === 'object' && model !== null) {
        for (const fn of Object.values(model)) {
          if (typeof fn?.mockReset === 'function') fn.mockReset();
        }
      }
      if (typeof model?.mockReset === 'function') model.mockReset();
    }
  });

  // ── POST /api/webhooks/kajabi/purchase ──
  describe('POST /api/webhooks/kajabi/purchase', () => {
    it('always returns 200', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/kajabi/purchase',
        payload: {},
      });
      expect(res.statusCode).toBe(200);
    });

    it('provisions a new subscriber on purchase', async () => {
      mockPrisma.subscriber.findFirst.mockResolvedValue(null);
      mockPrisma.subscriber.create.mockResolvedValue({
        id: 'new-sub-id',
        email: 'buyer@example.com',
        tier: 'trial',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/kajabi/purchase',
        payload: {
          id: 'evt_123',
          event: 'purchase',
          payload: {
            id: 'kajabi_contact_456',
            email: 'buyer@example.com',
            first_name: 'Jane',
            last_name: 'Doe',
            offer_id: 'offer_789',
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.received).toBe(true);
      expect(body.subscriber_id).toBe('new-sub-id');

      // Verify create was called with correct data
      expect(mockPrisma.subscriber.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'buyer@example.com',
          name: 'Jane Doe',
          tier: 'trial',
          kajabiContactId: 'kajabi_contact_456',
          kajabiOfferId: 'offer_789',
          onboardingStep: 'pending',
        }),
      });
    });

    it('activates an existing subscriber on re-purchase', async () => {
      mockPrisma.subscriber.findFirst.mockResolvedValue({
        id: 'existing-sub-id',
        email: 'buyer@example.com',
        tier: 'cancelled',
      });
      mockPrisma.subscriber.update.mockResolvedValue({
        id: 'existing-sub-id',
        email: 'buyer@example.com',
        tier: 'active',
        agent: null,
      });
      mockPrisma.agent.updateMany.mockResolvedValue({ count: 1 });

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/kajabi/purchase',
        payload: {
          id: 'evt_456',
          event: 'purchase',
          payload: {
            id: 'kajabi_contact_456',
            email: 'buyer@example.com',
            first_name: 'Jane',
            last_name: 'Doe',
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.subscriber_id).toBe('existing-sub-id');
      expect(body.status).toBe('active');

      // Verify update sets active and clears cancel date
      expect(mockPrisma.subscriber.update).toHaveBeenCalledWith({
        where: { id: 'existing-sub-id' },
        data: expect.objectContaining({
          tier: 'active',
          kajabiCancelDate: null,
        }),
        include: { agent: true },
      });
    });

    it('returns 200 with error for missing email', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/kajabi/purchase',
        payload: {
          id: 'evt_789',
          event: 'purchase',
          payload: { id: 'contact_123' },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('missing_email');
    });

    it('accepts order.created event (Kajabi Cart Purchase)', async () => {
      mockPrisma.subscriber.findFirst.mockResolvedValue(null);
      mockPrisma.subscriber.create.mockResolvedValue({
        id: 'new-sub-oc',
        email: 'oc-buyer@example.com',
        tier: 'trial',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/kajabi/purchase',
        payload: {
          id: 'evt_oc_1',
          event: 'order.created',
          payload: {
            id: 'kajabi_oc_contact',
            email: 'oc-buyer@example.com',
            first_name: 'Order',
            last_name: 'Created',
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.subscriber_id).toBe('new-sub-oc');
      expect(mockPrisma.subscriber.create).toHaveBeenCalled();
    });

    it('accepts payment.succeeded event', async () => {
      mockPrisma.subscriber.findFirst.mockResolvedValue({
        id: 'existing-ps',
        email: 'ps-buyer@example.com',
        tier: 'active',
      });
      mockPrisma.subscriber.update.mockResolvedValue({
        id: 'existing-ps',
        email: 'ps-buyer@example.com',
        tier: 'active',
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/kajabi/purchase',
        payload: {
          id: 'evt_ps_1',
          event: 'payment.succeeded',
          payload: {
            id: 'kajabi_ps_contact',
            email: 'ps-buyer@example.com',
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.subscriber_id).toBe('existing-ps');
    });

    it('ignores non-purchase events gracefully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/kajabi/purchase',
        payload: {
          id: 'evt_999',
          event: 'tag_added',
          payload: { email: 'someone@example.com' },
        },
      });

      expect(res.statusCode).toBe(200);
      expect(mockPrisma.subscriber.findFirst).not.toHaveBeenCalled();
    });
  });

  // ── POST /api/webhooks/kajabi/cancel ──
  describe('POST /api/webhooks/kajabi/cancel', () => {
    it('always returns 200', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/kajabi/cancel',
        payload: {},
      });
      expect(res.statusCode).toBe(200);
    });

    it('cancels an active subscriber', async () => {
      mockPrisma.subscriber.findFirst.mockResolvedValue({
        id: 'sub-to-cancel',
        email: 'canceller@example.com',
        tier: 'active',
      });
      mockPrisma.subscriber.findUnique.mockResolvedValue({
        id: 'sub-to-cancel',
        email: 'canceller@example.com',
        tier: 'active',
        agent: null,
      });
      mockPrisma.subscriber.update.mockResolvedValue({
        id: 'sub-to-cancel',
        tier: 'cancelled',
      });
      mockPrisma.agent.updateMany.mockResolvedValue({ count: 1 });

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/kajabi/cancel',
        payload: {
          id: 'evt_cancel_1',
          event: 'tag_added',
          payload: {
            email: 'canceller@example.com',
            id: 'kajabi_contact_789',
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.subscriber_id).toBe('sub-to-cancel');
      expect(body.status).toBe('cancelled');

      // Verify tier set to cancelled
      expect(mockPrisma.subscriber.update).toHaveBeenCalledWith({
        where: { id: 'sub-to-cancel' },
        data: expect.objectContaining({
          tier: 'cancelled',
        }),
      });

      // Verify agent deactivated
      expect(mockPrisma.agent.updateMany).toHaveBeenCalledWith({
        where: { subscriberId: 'sub-to-cancel', isActive: true },
        data: { isActive: false },
      });
    });

    it('returns 200 with error for unknown subscriber', async () => {
      mockPrisma.subscriber.findFirst.mockResolvedValue(null);

      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/kajabi/cancel',
        payload: {
          id: 'evt_cancel_2',
          event: 'tag_added',
          payload: {
            email: 'unknown@example.com',
          },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('subscriber_not_found');
    });

    it('returns 200 with error for missing identifier', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/webhooks/kajabi/cancel',
        payload: {
          id: 'evt_cancel_3',
          event: 'tag_added',
          payload: {},
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.error).toBe('missing_identifier');
    });
  });
});
