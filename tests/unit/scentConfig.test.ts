import { describe, it, expect } from 'vitest';
import { ANIMAL_SCALE } from '../../src/config/animalConfig';
import {
  DEFAULT_SCENT_PARAMS,
  ANIMAL_PROFILES,
  DEFAULT_SCENT_VISUAL_CONFIG,
  getAnimalProfile
} from '../../src/config/scentConfig';

describe('DEFAULT_SCENT_PARAMS', () => {
  it('has correct default values', () => {
    expect(DEFAULT_SCENT_PARAMS.maxTrailAge).toBe(25000);
    expect(DEFAULT_SCENT_PARAMS.tauDecay).toBe(8000);
    expect(DEFAULT_SCENT_PARAMS.scentSpreadSigma).toBe(2.0);
    expect(DEFAULT_SCENT_PARAMS.tauDecayMin).toBe(6000);
    expect(DEFAULT_SCENT_PARAMS.tauDecayMax).toBe(10000);
    expect(DEFAULT_SCENT_PARAMS.emitSpacing).toBe(1.0);
  });
});

describe('ANIMAL_PROFILES', () => {
  it('has dog profile with correct values', () => {
    const dog = ANIMAL_PROFILES['dog'];
    expect(dog.animalType).toBe('dog');
    expect(dog.baseIntensity).toBe(1.0);
    expect(dog.emitInterval).toBe(200);
    expect(dog.spreadRadius).toBe(0.75);
    expect(dog.emitProbability).toBe(0.8);
    expect(dog.maxTrailAge).toBe(25000);
    expect(dog.tauDecay).toBe(8000);
    expect(dog.scentSpreadSigma).toBe(2.0);
    expect(dog.tauDecayMin).toBe(6000);
    expect(dog.tauDecayMax).toBe(10000);
    expect(dog.emitSpacing).toBe(0.5);
  });

  it('has cow profile with correct values', () => {
    const cow = ANIMAL_PROFILES['cow'];
    expect(cow.animalType).toBe('cow');
    expect(cow.baseIntensity).toBe(1.5);
    expect(cow.emitInterval).toBe(300);
    expect(cow.spreadRadius).toBe(2.0);
    expect(cow.emitProbability).toBe(0.6);
    expect(cow.maxTrailAge).toBe(25000);
    expect(cow.tauDecay).toBe(8000);
    expect(cow.scentSpreadSigma).toBe(2.0);
    expect(cow.tauDecayMin).toBe(8000);
    expect(cow.tauDecayMax).toBe(14000);
    expect(cow.emitSpacing).toBe(1.0);
  });

  it('has pig profile with correct values', () => {
    const pig = ANIMAL_PROFILES['pig'];
    expect(pig.animalType).toBe('pig');
    expect(pig.baseIntensity).toBe(0.8);
    expect(pig.emitInterval).toBe(150);
    expect(pig.spreadRadius).toBe(1.2);
    expect(pig.emitProbability).toBe(0.9);
    expect(pig.maxTrailAge).toBe(25000);
    expect(pig.tauDecay).toBe(8000);
    expect(pig.scentSpreadSigma).toBe(2.0);
    expect(pig.tauDecayMin).toBe(4000);
    expect(pig.tauDecayMax).toBe(8000);
    expect(pig.emitSpacing).toBe(0.3);
  });
});

describe('DEFAULT_SCENT_VISUAL_CONFIG', () => {
  it('has pointSize computed from ANIMAL_SCALE', () => {
    expect(DEFAULT_SCENT_VISUAL_CONFIG.pointSize).toBe(ANIMAL_SCALE * 0.2);
  });

  it('has minHeight computed from ANIMAL_SCALE', () => {
    expect(DEFAULT_SCENT_VISUAL_CONFIG.minHeight).toBe(ANIMAL_SCALE * 0.05);
  });

  it('has correct animalColorMap values', () => {
    expect(DEFAULT_SCENT_VISUAL_CONFIG.animalColorMap['dog']).toBe(0xff9933);
    expect(DEFAULT_SCENT_VISUAL_CONFIG.animalColorMap['cow']).toBe(0x44aa44);
    expect(DEFAULT_SCENT_VISUAL_CONFIG.animalColorMap['pig']).toBe(0xff6688);
  });
});

describe('getAnimalProfile', () => {
  it('returns dog profile for dog animalType', () => {
    const profile = getAnimalProfile('dog');
    expect(profile.animalType).toBe('dog');
    expect(profile.baseIntensity).toBe(1.0);
    expect(profile.emitInterval).toBe(200);
    expect(profile.spreadRadius).toBe(0.75);
  });

  it('returns cow profile for cow animalType', () => {
    const profile = getAnimalProfile('cow');
    expect(profile.animalType).toBe('cow');
    expect(profile.baseIntensity).toBe(1.5);
    expect(profile.emitInterval).toBe(300);
    expect(profile.spreadRadius).toBe(2.0);
  });

  it('returns pig profile for pig animalType', () => {
    const profile = getAnimalProfile('pig');
    expect(profile.animalType).toBe('pig');
    expect(profile.baseIntensity).toBe(0.8);
    expect(profile.emitInterval).toBe(150);
    expect(profile.spreadRadius).toBe(1.2);
  });

  it('returns dynamic default for unknown animalType', () => {
    const profile = getAnimalProfile('cat');
    expect(profile.animalType).toBe('cat');
    expect(profile.baseIntensity).toBe(1.0);
    expect(profile.emitInterval).toBe(250);
    expect(profile.spreadRadius).toBe(0.75);
    expect(profile.emitProbability).toBe(0.5);
    expect(profile.maxTrailAge).toBe(DEFAULT_SCENT_PARAMS.maxTrailAge);
    expect(profile.tauDecay).toBe(DEFAULT_SCENT_PARAMS.tauDecay);
    expect(profile.scentSpreadSigma).toBe(DEFAULT_SCENT_PARAMS.scentSpreadSigma);
    expect(profile.tauDecayMin).toBe(DEFAULT_SCENT_PARAMS.tauDecayMin);
    expect(profile.tauDecayMax).toBe(DEFAULT_SCENT_PARAMS.tauDecayMax);
    expect(profile.emitSpacing).toBe(DEFAULT_SCENT_PARAMS.emitSpacing);
  });
});
