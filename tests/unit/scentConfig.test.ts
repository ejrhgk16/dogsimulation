import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SCENT_PARAMS,
  OWNER_PROFILES,
  DEFAULT_SCENT_VISUAL_CONFIG,
  getOwnerProfile
} from '../../src/config/scentConfig';

describe('DEFAULT_SCENT_PARAMS', () => {
  it('has correct default values', () => {
    expect(DEFAULT_SCENT_PARAMS.maxTrailAge).toBe(10000);
    expect(DEFAULT_SCENT_PARAMS.tauDecay).toBe(3000);
    expect(DEFAULT_SCENT_PARAMS.scentSpreadSigma).toBe(2.0);
  });
});

describe('OWNER_PROFILES', () => {
  it('has dog profile with correct values', () => {
    const dog = OWNER_PROFILES['dog'];
    expect(dog.ownerType).toBe('dog');
    expect(dog.baseIntensity).toBe(1.0);
    expect(dog.emitSpacing).toBe(0.5);
    expect(dog.emitProbability).toBe(0.8);
    expect(dog.maxTrailAge).toBe(10000);
    expect(dog.tauDecay).toBe(3000);
    expect(dog.scentSpreadSigma).toBe(2.0);
  });

  it('has cow profile with correct values', () => {
    const cow = OWNER_PROFILES['cow'];
    expect(cow.ownerType).toBe('cow');
    expect(cow.baseIntensity).toBe(1.5);
    expect(cow.emitSpacing).toBe(1.0);
    expect(cow.emitProbability).toBe(0.6);
    expect(cow.maxTrailAge).toBe(10000);
    expect(cow.tauDecay).toBe(3000);
    expect(cow.scentSpreadSigma).toBe(2.0);
  });

  it('has pig profile with correct values', () => {
    const pig = OWNER_PROFILES['pig'];
    expect(pig.ownerType).toBe('pig');
    expect(pig.baseIntensity).toBe(0.8);
    expect(pig.emitSpacing).toBe(0.3);
    expect(pig.emitProbability).toBe(0.9);
    expect(pig.maxTrailAge).toBe(10000);
    expect(pig.tauDecay).toBe(3000);
    expect(pig.scentSpreadSigma).toBe(2.0);
  });
});

describe('DEFAULT_SCENT_VISUAL_CONFIG', () => {
  it('has correct values', () => {
    expect(DEFAULT_SCENT_VISUAL_CONFIG.pointSize).toBe(0.15);
    expect(DEFAULT_SCENT_VISUAL_CONFIG.minHeight).toBe(0.1);
    expect(DEFAULT_SCENT_VISUAL_CONFIG.maxHeight).toBe(0.6);
    expect(DEFAULT_SCENT_VISUAL_CONFIG.ownerColorMap['dog']).toBe(0xff9933);
    expect(DEFAULT_SCENT_VISUAL_CONFIG.ownerColorMap['cow']).toBe(0x44aa44);
    expect(DEFAULT_SCENT_VISUAL_CONFIG.ownerColorMap['pig']).toBe(0xff6688);
  });
});

describe('getOwnerProfile', () => {
  it('returns dog profile for dog ownerType', () => {
    const profile = getOwnerProfile('dog');
    expect(profile.ownerType).toBe('dog');
    expect(profile.baseIntensity).toBe(1.0);
    expect(profile.emitSpacing).toBe(0.5);
  });

  it('returns cow profile for cow ownerType', () => {
    const profile = getOwnerProfile('cow');
    expect(profile.ownerType).toBe('cow');
    expect(profile.baseIntensity).toBe(1.5);
    expect(profile.emitSpacing).toBe(1.0);
  });

  it('returns pig profile for pig ownerType', () => {
    const profile = getOwnerProfile('pig');
    expect(profile.ownerType).toBe('pig');
    expect(profile.baseIntensity).toBe(0.8);
    expect(profile.emitSpacing).toBe(0.3);
  });

  it('returns dynamic default for unknown ownerType', () => {
    const profile = getOwnerProfile('cat');
    expect(profile.ownerType).toBe('cat');
    expect(profile.baseIntensity).toBe(1.0);
    expect(profile.emitSpacing).toBe(1.0);
    expect(profile.emitProbability).toBe(0.5);
    expect(profile.maxTrailAge).toBe(DEFAULT_SCENT_PARAMS.maxTrailAge);
    expect(profile.tauDecay).toBe(DEFAULT_SCENT_PARAMS.tauDecay);
    expect(profile.scentSpreadSigma).toBe(DEFAULT_SCENT_PARAMS.scentSpreadSigma);
  });
});
