import { t, TKey } from '../../i18n';

/**
 * Localized HUD text as plain strings. Worklets can't call t(), but they capture this object,
 * and templates with {n} are filled on the UI thread with the worklet-safe fill().
 */
export const HUD = {
  score: t('hud.score'),
  newBest: t('hud.newBest'),
  best: t('hud.best'),
  toBest: t('hud.toBest'),
  slowmo: t('hud.slowmo'),
  fever: t('hud.fever'),
  flapHint: t('hud.flapHint'),
  tutorial: t('hud.tutorial'),
  niceSave: t('hud.niceSave'),
  challengeClear: t('hud.challengeClear'),
  missed: t('hud.missed'),
  flag: t('hud.flag'),

  rock: t('evt.rock'),
  branch: t('evt.branch'),
  gust: t('evt.gust'),
  ice: t('evt.ice'),
  quake: t('evt.quake'),
  centered: t('evt.centered'),
  lean: t('evt.lean'),
  storm: t('evt.storm'),
  sprint: t('evt.sprint'),
  slow: t('evt.slow'),
  gull: t('evt.gull'),
  gullPerched: t('evt.gullPerched'),
  coinRain: t('evt.coinRain'),

  milestone: t('pop.milestone'),
  milestoneLabel: t('pop.milestoneLabel'),
  rankLabel: t('pop.rankLabel'),
  areaLabel: t('pop.areaLabel'),
  feverPop: t('pop.fever'),
  feverLabel: t('pop.feverLabel'),
  magnet: t('pop.magnet'),
  feather: t('pop.feather'),
  balloon: t('pop.balloon'),
  itemLabel: t('pop.itemLabel'),
  chick: t('pop.chick'),
  chickLabel: t('pop.chickLabel'),
  shield: t('pop.shield'),
  shieldLabel: t('pop.shieldLabel'),
  record: t('pop.record'),
  recordLabel: t('pop.recordLabel'),

  dodge: t('float.dodge'),
  steady: t('float.steady'),
  shoo: t('float.shoo'),
  bonk: t('float.bonk'),
  nice: t('float.nice'),

  tutHoldLeft: t('tut.holdLeft'),
  tutHoldRight: t('tut.holdRight'),
  tutFlap: t('tut.flap'),
  tutReady: t('tut.ready'),

  biomes: [0, 1, 2, 3].map((i) => t(`biome.${i}` as TKey).toUpperCase()),
} as const;
