/**
 * English strings: the source of truth for every translation key.
 * Placeholders use {name}; every locale must keep the same placeholders.
 */
export const en = {
  // Start screen
  'start.missions': "TODAY'S MISSIONS",
  'start.subtitle': 'THE WOBBLY FLAMINGO',
  'start.best': 'BEST',
  'start.play': 'PLAY',
  'start.daily': "TODAY'S COURSE",
  'start.dailyNote': 'Same course for everyone today',
  'start.dailyNoteBest': "Today's best {n} · same course for everyone",

  // Shared
  'common.skins': 'SKINS',
  'common.upgrades': 'UPGRADES',
  'common.close': 'CLOSE',
  'common.ad': 'AD',
  'common.watchAd': '{label}, watch an ad',
  'lang.title': 'LANGUAGE',
  'lang.auto': 'Device language',

  // Daily login gift
  'streak.title': 'DAILY GIFT',
  'streak.day': 'DAY {n}',
  'streak.claim': 'CLAIM +{n}',
  'streak.claimed': 'Come back tomorrow for +{n}',

  // Game over
  'over.dailyTag': "TODAY'S COURSE · {day}",
  'over.newBest': 'NEW BEST!',
  'over.dailyBest': "TODAY'S BEST!",
  'over.gameOver': 'GAME OVER',
  'over.soClose': 'SO CLOSE!',
  'over.metersShort': 'Only {n} m from your best!',
  'over.score': 'SCORE',
  'over.best': 'BEST {n}',
  'over.toNextRank': '{n} m to {name}',
  'over.topRank': 'Top rank reached!',
  'over.combo': 'COMBO',
  'over.fever': 'FEVER',
  'over.dodges': 'DODGES',
  'over.babies': 'BABIES',
  'over.fromMissions': '({n} from missions)',
  'over.wallet': 'wallet {n}',
  'over.todaysBest': "TODAY'S BEST {n}",
  'over.topRuns': 'Your top runs: {list}',
  'over.retry': 'RETRY',
  'over.share': 'SHARE SCORE',
  'over.home': 'HOME',
  'over.bonus': 'BONUS',
  'over.continue': 'CONTINUE',
  'over.shield': 'SHIELD',
  'over.slowmo': 'SLOW-MO',
  'over.missions': "TODAY'S MISSIONS",
  'over.completed': '{n} COMPLETED!',

  // Share sheet
  'share.daily': "I scored {score} and walked {m} m on today's course ({day}) in Wobby! {rank}",
  'share.normal': 'I scored {score} and walked {m} m in Wobby! {rank}',

  // Skins
  'skins.subtitle': 'Buy with coins to keep forever, or watch an ad to wear one for 24 hours',
  'skins.wearing': 'WEARING',
  'skins.wear': 'WEAR',
  'skins.rent': '24H',
  'skin.default': 'Pink',
  'skin.golden': 'Golden',
  'skin.arctic': 'Arctic',
  'skin.midnight': 'Midnight',
  'skin.sunset': 'Sunset',
  'skin.cherry': 'Cherry',

  // Upgrades
  'up.subtitle': 'Permanent boosts for every run',
  'up.magnet': 'MAGNET',
  'up.magnetDesc': 'Coin magnet lasts longer',
  'up.fever': 'FEVER',
  'up.feverDesc': 'Fever lasts longer',
  'up.luck': 'LUCKY FIND',
  'up.luckDesc': 'Items show up more often',
  'up.balloon': 'STARTER BALLOON',
  'up.balloonDesc': 'Start runs with a rescue balloon',
  'up.perDay': '{n}/day',
  'up.max': 'MAX',
  'up.level': 'LV {n}',

  // Ranks
  'rank.0': 'Egg',
  'rank.1': 'Chick',
  'rank.2': 'Fledgling',
  'rank.3': 'Flamingo',
  'rank.4': 'Eagle',
  'rank.5': 'King of Birds',
  'rank.6': 'Legendary Bird',

  // Zones
  'biome.0': 'Meadow',
  'biome.1': 'Beach',
  'biome.2': 'Snowy Peaks',
  'biome.3': 'Autumn Woods',

  // Missions
  'mission.coins_run': 'Collect {n} coins in one run',
  'mission.coins_day': 'Collect {n} coins today',
  'mission.meters_run': 'Walk {n} m in one run',
  'mission.dodges_run': 'Dodge or brace {n} times in one run',
  'mission.fever_one': 'Trigger FEVER',
  'mission.fever_run': 'Trigger FEVER {n} times in one run',
  'mission.survive_run': 'Survive {n} seconds',
  'mission.challenges_run': 'Clear {n} challenges in one run',
  'mission.runs_day': 'Play {n} runs today',
  'mission.flaps_day': 'Flap {n} times today',
  'mission.chicks_one': 'Get a baby flamingo',
  'mission.chicks_run': 'Have {n} baby flamingos at once',
  'mission.zone_run': 'Reach the {zone}',
  'mission.daily_play': "Play today's course",
  'mission.items_one': 'Grab an item',
  'mission.items_run': 'Grab {n} items in one run',

  // In-game HUD
  'hud.score': 'SCORE',
  'hud.newBest': 'NEW BEST!',
  'hud.best': 'BEST {n}',
  'hud.toBest': '{n} m TO BEST',
  'hud.slowmo': 'SLOW-MO {n}',
  'hud.fever': 'FEVER x2',
  'hud.flapHint': 'TAP BOTH SIDES TO FLAP',
  'hud.tutorial': 'HOLD LEFT OR RIGHT SIDE TO BALANCE',
  'hud.niceSave': 'NICE SAVE!',
  'hud.challengeClear': 'CHALLENGE CLEAR!',
  'hud.missed': 'MISSED IT',
  'hud.flag': 'BEST',

  // Event banners
  'evt.rock': 'ROCK! LEAN',
  'evt.branch': 'HEADS UP! LEAN',
  'evt.gust': 'GUST! PUSH BACK',
  'evt.ice': 'ICE! SLIPPERY',
  'evt.quake': 'QUAKE!',
  'evt.centered': 'STAY CENTERED',
  'evt.lean': 'LEAN AND HOLD',
  'evt.storm': 'SURVIVE THE STORM',
  'evt.sprint': 'SPRINT! x1.5 POINTS',
  'evt.slow': 'SLOW DOWN',
  'evt.gull': 'SEAGULL! FLAP TO SHOO',
  'evt.gullPerched': 'FLAP!',
  'evt.coinRain': 'COIN RAIN! LEAN TO CATCH',

  // Popups (big text + small label)
  'pop.milestone': '{n} m!',
  'pop.milestoneLabel': 'MILESTONE',
  'pop.rankLabel': 'RANK UP',
  'pop.areaLabel': 'NEW AREA',
  'pop.fever': 'x2 POINTS!',
  'pop.feverLabel': 'COMBO FEVER',
  'pop.magnet': 'MAGNET!',
  'pop.feather': 'FEATHER CALM!',
  'pop.balloon': 'BALLOON!',
  'pop.itemLabel': 'ITEM',
  'pop.chick': '+{n}% POINTS',
  'pop.chickLabel': 'A BABY JOINED YOU',
  'pop.shield': 'SHIELD SAVE!',
  'pop.shieldLabel': 'SAVED',
  'pop.record': 'NEW RECORD!',
  'pop.recordLabel': 'PERSONAL BEST',

  // Floating texts
  'float.dodge': 'DODGE +{n}',
  'float.steady': 'STEADY +{n}',
  'float.shoo': 'SHOO +{n}',
  'float.bonk': 'BONK!',
  'float.nice': 'NICE!',

  // First-run tutorial
  'tut.holdLeft': 'HOLD THE LEFT SIDE',
  'tut.holdRight': 'NOW HOLD THE RIGHT SIDE',
  'tut.flap': 'TAP BOTH SIDES TO FLAP!',
  'tut.ready': "YOU'RE READY!",
} as const;

export type TKey = keyof typeof en;
export type Strings = Record<TKey, string>;
