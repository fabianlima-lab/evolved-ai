import { stripHtml } from '../utils/helpers.js';
import prisma from '../lib/prisma.js';

async function subscriberRoutes(app) {
  // POST /api/subscribers/goals — save onboarding goals
  app.post('/goals', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;
    const { goals } = request.body || {};

    if (!goals || (typeof goals !== 'string' && !Array.isArray(goals))) {
      return reply.code(400).send({ error: 'goals is required (string or array)' });
    }

    const goalsStr = Array.isArray(goals)
      ? goals.map((g) => stripHtml(String(g)).slice(0, 100)).join(',')
      : stripHtml(String(goals)).slice(0, 500);

    try {
      await prisma.subscriber.update({
        where: { id: subscriberId },
        data: { goals: goalsStr },
      });

      console.log(`[SUBSCRIBER] goals saved for subscriber:${subscriberId} → ${goalsStr}`);
      return reply.send({ success: true, goals: goalsStr });
    } catch (error) {
      console.error('[ERROR] save goals failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // PATCH /api/subscribers/onboarding-step — update onboarding progress
  const VALID_STEPS = ['pending', 'google_oauth', 'whatsapp_connect', 'conversational', 'complete'];

  app.patch('/onboarding-step', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;
    const { step } = request.body || {};

    if (!step || !VALID_STEPS.includes(step)) {
      return reply.code(400).send({
        error: `Invalid step. Must be one of: ${VALID_STEPS.join(', ')}`,
      });
    }

    try {
      const data = { onboardingStep: step };

      // When marking complete, also set the legacy flag
      if (step === 'complete') {
        data.onboardingComplete = true;
      }

      await prisma.subscriber.update({
        where: { id: subscriberId },
        data,
      });

      console.log(`[SUBSCRIBER] onboarding step → ${step} for subscriber:${subscriberId}`);
      return reply.send({ success: true, step });
    } catch (error) {
      console.error('[ERROR] update onboarding step failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });

  // POST /api/subscribers/profile — save onboarding profile data
  app.post('/profile', {
    preHandler: [app.authenticate],
    config: {
      rateLimit: { max: 30, timeWindow: '1 minute' },
    },
  }, async (request, reply) => {
    const subscriberId = request.user.userId;
    const { name, role, priorities, desiredFeeling, preferences, briefingTime, wrapTime, timezone, communicationPreferences, schedulePreferences } = request.body || {};

    if (!name && !role && !priorities && !desiredFeeling && !preferences && !timezone && !communicationPreferences && !schedulePreferences) {
      return reply.code(400).send({ error: 'At least one profile field is required' });
    }

    // Build profile data object, sanitizing string inputs
    const profileData = {};
    if (name) profileData.name = stripHtml(String(name)).slice(0, 100);
    if (role) profileData.role = stripHtml(String(role)).slice(0, 200);
    if (priorities) {
      profileData.priorities = Array.isArray(priorities)
        ? priorities.map((p) => stripHtml(String(p)).slice(0, 200)).slice(0, 10)
        : [stripHtml(String(priorities)).slice(0, 200)];
    }
    if (desiredFeeling) profileData.desiredFeeling = stripHtml(String(desiredFeeling)).slice(0, 300);
    if (preferences) profileData.preferences = stripHtml(String(preferences)).slice(0, 500);
    if (briefingTime) profileData.briefingTime = stripHtml(String(briefingTime)).slice(0, 20);
    if (wrapTime) profileData.wrapTime = stripHtml(String(wrapTime)).slice(0, 20);
    if (timezone) profileData.timezone = stripHtml(String(timezone)).slice(0, 50);
    if (communicationPreferences) {
      profileData.communicationPreferences = typeof communicationPreferences === 'object'
        ? communicationPreferences
        : { notes: stripHtml(String(communicationPreferences)).slice(0, 500) };
    }
    if (schedulePreferences) {
      profileData.schedulePreferences = typeof schedulePreferences === 'object'
        ? schedulePreferences
        : { notes: stripHtml(String(schedulePreferences)).slice(0, 500) };
    }

    try {
      // Merge with existing profileData (don't overwrite unrelated fields)
      const existing = await prisma.subscriber.findUnique({
        where: { id: subscriberId },
        select: { profileData: true },
      });

      const merged = {
        ...(existing?.profileData && typeof existing.profileData === 'object' ? existing.profileData : {}),
        ...profileData,
      };

      await prisma.subscriber.update({
        where: { id: subscriberId },
        data: {
          profileData: merged,
          ...(name ? { name: profileData.name } : {}),
        },
      });

      console.log(`[SUBSCRIBER] profile saved for subscriber:${subscriberId}`);
      return reply.send({ success: true, profileData: merged });
    } catch (error) {
      console.error('[ERROR] save profile failed:', error.message);
      return reply.code(500).send({ error: 'Something went wrong. Try again in a moment.' });
    }
  });
}

export default subscriberRoutes;
