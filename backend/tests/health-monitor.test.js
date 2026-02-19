import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock baileys before importing health-monitor
vi.mock('../src/services/baileys.js', () => ({
  getBaileysStatus: vi.fn().mockReturnValue({ status: 'open', qr: null }),
}));

// Mock env
vi.mock('../src/config/env.js', () => ({
  default: {
    SMTP_USER: '',
    SMTP_PASS: '',
    ADMIN_EMAILS: [],
    NODE_ENV: 'test',
  },
}));

import { getBaileysStatus } from '../src/services/baileys.js';
import {
  getDetailedHealth,
  startHealthMonitor,
  stopHealthMonitor,
} from '../src/services/health-monitor.js';

describe('Health Monitor (REQ-010 / REQ-014)', () => {
  afterEach(() => {
    stopHealthMonitor();
    vi.restoreAllMocks();
  });

  // ── getDetailedHealth ──
  describe('getDetailedHealth()', () => {
    it('returns status ok', () => {
      const health = getDetailedHealth();
      expect(health.status).toBe('ok');
    });

    it('includes timestamp', () => {
      const health = getDetailedHealth();
      expect(health.timestamp).toBeDefined();
      expect(new Date(health.timestamp).getTime()).not.toBeNaN();
    });

    it('includes uptime as number', () => {
      const health = getDetailedHealth();
      expect(typeof health.uptime).toBe('number');
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it('includes WhatsApp status', () => {
      getBaileysStatus.mockReturnValue({ status: 'open', qr: null });
      const health = getDetailedHealth();
      expect(health.whatsapp).toBeDefined();
      expect(health.whatsapp.status).toBe('open');
    });

    it('includes whatsapp disconnectedSince as null when connected', () => {
      getBaileysStatus.mockReturnValue({ status: 'open', qr: null });
      const health = getDetailedHealth();
      expect(health.whatsapp.disconnectedSince).toBeNull();
    });

    it('includes memory stats', () => {
      const health = getDetailedHealth();
      expect(health.memory).toBeDefined();
      expect(typeof health.memory.rss_mb).toBe('number');
      expect(typeof health.memory.heap_used_mb).toBe('number');
      expect(typeof health.memory.heap_total_mb).toBe('number');
    });

    it('memory stats are positive numbers', () => {
      const health = getDetailedHealth();
      expect(health.memory.rss_mb).toBeGreaterThan(0);
      expect(health.memory.heap_used_mb).toBeGreaterThan(0);
      expect(health.memory.heap_total_mb).toBeGreaterThan(0);
    });

    it('includes scheduler statuses', () => {
      const health = getDetailedHealth();
      expect(health.schedulers).toBeDefined();
      expect(health.schedulers.reminder).toBe('running');
      expect(health.schedulers.briefing).toBe('running');
      expect(health.schedulers.memory_cleanup).toBe('running');
      expect(health.schedulers.weekly_recap).toBe('running');
      expect(health.schedulers.lifecycle).toBe('running');
      expect(health.schedulers.health_monitor).toBe('running');
    });

    it('reflects disconnected WhatsApp status', () => {
      getBaileysStatus.mockReturnValue({ status: 'disconnected', qr: null });
      const health = getDetailedHealth();
      expect(health.whatsapp.status).toBe('disconnected');
    });

    it('reflects connecting WhatsApp status', () => {
      getBaileysStatus.mockReturnValue({ status: 'connecting', qr: 'data:image/png;base64,...' });
      const health = getDetailedHealth();
      expect(health.whatsapp.status).toBe('connecting');
    });
  });

  // ── startHealthMonitor / stopHealthMonitor ──
  describe('startHealthMonitor()', () => {
    it('starts without error', () => {
      expect(() => startHealthMonitor()).not.toThrow();
    });

    it('can be called multiple times without error (idempotent)', () => {
      startHealthMonitor();
      expect(() => startHealthMonitor()).not.toThrow();
    });

    it('can be stopped', () => {
      startHealthMonitor();
      expect(() => stopHealthMonitor()).not.toThrow();
    });

    it('can be stopped when not running', () => {
      expect(() => stopHealthMonitor()).not.toThrow();
    });
  });
});
