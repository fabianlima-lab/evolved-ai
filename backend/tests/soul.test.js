import { describe, it, expect } from 'vitest';
import { compileSoulMd, getSoulTemplate, buildProfileContext, BASE_SOUL_MD, VETS_SOUL_MD } from '../src/prompts/soul.js';

describe('SOUL.md Personality System', () => {
  // ── Templates ──
  describe('Templates', () => {
    it('BASE_SOUL_MD contains core personality traits', () => {
      expect(BASE_SOUL_MD).toContain('Warm');
      expect(BASE_SOUL_MD).toContain('Polished');
      expect(BASE_SOUL_MD).toContain('Calm');
      expect(BASE_SOUL_MD).toContain('Grounded');
      expect(BASE_SOUL_MD).toContain('Friendly');
    });

    it('BASE_SOUL_MD contains A.O.A.A. response framework', () => {
      expect(BASE_SOUL_MD).toContain('Acknowledge');
      expect(BASE_SOUL_MD).toContain('Organize');
      expect(BASE_SOUL_MD).toContain('Act');
      expect(BASE_SOUL_MD).toContain('Anticipate');
    });

    it('BASE_SOUL_MD contains security boundaries', () => {
      expect(BASE_SOUL_MD).toContain('not a licensed professional');
      expect(BASE_SOUL_MD).toContain('Never share information about one subscriber');
    });

    it('BASE_SOUL_MD has template placeholders', () => {
      expect(BASE_SOUL_MD).toContain('{{ASSISTANT_NAME}}');
      expect(BASE_SOUL_MD).toContain('{{PROFILE_CONTEXT}}');
    });

    it('VETS_SOUL_MD contains veterinary-specific content', () => {
      expect(VETS_SOUL_MD).toContain('veterinary');
      expect(VETS_SOUL_MD).toContain('compassion fatigue');
      expect(VETS_SOUL_MD).toContain('CE tracking');
      expect(VETS_SOUL_MD).toContain('Practice management');
    });

    it('VETS_SOUL_MD contains clinical safety boundary', () => {
      expect(VETS_SOUL_MD).toContain('NOT a veterinary medical advisor');
      expect(VETS_SOUL_MD).toContain('Never provide clinical diagnoses');
    });

    it('VETS_SOUL_MD has same template placeholders', () => {
      expect(VETS_SOUL_MD).toContain('{{ASSISTANT_NAME}}');
      expect(VETS_SOUL_MD).toContain('{{PROFILE_CONTEXT}}');
    });
  });

  // ── getSoulTemplate ──
  describe('getSoulTemplate()', () => {
    it('returns base template by default', () => {
      const result = getSoulTemplate();
      expect(result).toBe(BASE_SOUL_MD);
    });

    it('returns base template when variant is "base"', () => {
      const result = getSoulTemplate('base');
      expect(result).toBe(BASE_SOUL_MD);
    });

    it('returns vets template when variant is "vets"', () => {
      const result = getSoulTemplate('vets');
      expect(result).toBe(VETS_SOUL_MD);
    });

    it('returns base template for unknown variant', () => {
      const result = getSoulTemplate('unknown');
      expect(result).toBe(BASE_SOUL_MD);
    });
  });

  // ── buildProfileContext ──
  describe('buildProfileContext()', () => {
    it('returns default message when no data provided', () => {
      const result = buildProfileContext(null, null);
      expect(result).toContain('No personalization data');
      expect(result).toContain('new subscriber');
    });

    it('includes subscriber name from profileData', () => {
      const result = buildProfileContext({ name: 'Sarah' }, {});
      expect(result).toContain('**Name**: Sarah');
    });

    it('falls back to subscriber.name when profileData has no name', () => {
      const result = buildProfileContext({}, { name: 'Jane' });
      expect(result).toContain('**Name**: Jane');
    });

    it('includes role from profileData', () => {
      const result = buildProfileContext({ role: 'Veterinarian' }, {});
      expect(result).toContain('**Role**: Veterinarian');
    });

    it('includes priorities array', () => {
      const result = buildProfileContext({ priorities: ['Work-life balance', 'Client management'] }, {});
      expect(result).toContain('**Top priorities**: Work-life balance, Client management');
    });

    it('includes communication preferences', () => {
      const result = buildProfileContext({
        communicationPreferences: { tone: 'warm', length: 'concise', style: 'bullet points' },
      }, {});
      expect(result).toContain('**Preferred tone**: warm');
      expect(result).toContain('**Preferred response length**: concise');
      expect(result).toContain('**Communication style**: bullet points');
    });

    it('includes schedule preferences', () => {
      const result = buildProfileContext({
        schedulePreferences: { workingHours: '9am-5pm', timezone: 'EST', busyDays: 'Monday, Wednesday' },
      }, {});
      expect(result).toContain('**Working hours**: 9am-5pm');
      expect(result).toContain('**Timezone**: EST');
      expect(result).toContain('**Busiest days**: Monday, Wednesday');
    });

    it('includes legacy goals from subscriber when no priorities exist', () => {
      const result = buildProfileContext({}, { goals: 'Grow my practice' });
      expect(result).toContain('**Goals**: Grow my practice');
    });

    it('prefers priorities over legacy goals', () => {
      const result = buildProfileContext(
        { priorities: ['Scale business'] },
        { goals: 'Grow my practice' },
      );
      expect(result).toContain('**Top priorities**: Scale business');
      expect(result).not.toContain('Grow my practice');
    });

    it('builds complete profile with all fields', () => {
      const result = buildProfileContext({
        name: 'Dr. Emily Chen',
        role: 'Veterinary Surgeon',
        priorities: ['Surgery scheduling', 'Team management'],
        communicationPreferences: { tone: 'direct' },
        schedulePreferences: { timezone: 'PST' },
      }, {});
      expect(result).toContain('Dr. Emily Chen');
      expect(result).toContain('Veterinary Surgeon');
      expect(result).toContain('Surgery scheduling, Team management');
      expect(result).toContain('direct');
      expect(result).toContain('PST');
    });
  });

  // ── compileSoulMd ──
  describe('compileSoulMd()', () => {
    it('compiles base variant with assistant name', () => {
      const result = compileSoulMd({ assistantName: 'Luna' });
      expect(result).toContain('Your name is Luna.');
      expect(result).not.toContain('{{ASSISTANT_NAME}}');
      expect(result).not.toContain('{{PROFILE_CONTEXT}}');
    });

    it('compiles vets variant', () => {
      const result = compileSoulMd({ assistantName: 'Rex', variant: 'vets' });
      expect(result).toContain('Your name is Rex.');
      expect(result).toContain('veterinary');
      expect(result).toContain('NOT a veterinary medical advisor');
    });

    it('defaults to "Evolved AI" when no assistant name given', () => {
      const result = compileSoulMd({});
      expect(result).toContain('Your name is Evolved AI.');
    });

    it('defaults to base variant', () => {
      const result = compileSoulMd({ assistantName: 'Test' });
      expect(result).not.toContain('veterinary');
      expect(result).toContain('high-achieving women');
    });

    it('injects subscriber profile data', () => {
      const result = compileSoulMd({
        assistantName: 'Aria',
        profileData: {
          name: 'Sarah',
          role: 'CEO',
          priorities: ['Strategy', 'Team building'],
        },
        subscriber: {},
      });
      expect(result).toContain('**Name**: Sarah');
      expect(result).toContain('**Role**: CEO');
      expect(result).toContain('Strategy, Team building');
    });

    it('shows default context when no profile data', () => {
      const result = compileSoulMd({ assistantName: 'Aria' });
      expect(result).toContain('No personalization data');
    });

    it('replaces all occurrences of assistant name', () => {
      const result = compileSoulMd({ assistantName: 'Stella' });
      expect(result).not.toContain('{{ASSISTANT_NAME}}');
      // The name appears at least in the "Your name is" line
      const nameCount = (result.match(/Stella/g) || []).length;
      expect(nameCount).toBeGreaterThanOrEqual(1);
    });

    it('compiled output is a substantial system prompt', () => {
      const result = compileSoulMd({ assistantName: 'Test', variant: 'base' });
      // Should be a multi-section document
      expect(result.length).toBeGreaterThan(1000);
      expect(result).toContain('## Identity');
      expect(result).toContain('## Core Personality Traits');
      expect(result).toContain('## Communication Style');
      expect(result).toContain('## Boundaries & Safety');
    });

    it('vets variant has veterinary-specific sections', () => {
      const result = compileSoulMd({ assistantName: 'Buddy', variant: 'vets' });
      expect(result).toContain('## Veterinary-Specific Capabilities');
      expect(result).toContain('CE tracking');
      expect(result).toContain('compassion fatigue');
    });
  });
});
