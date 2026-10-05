// What gets captured. Times are simulation seconds of one seeded run played by the bot, so every
// language shows exactly the same moments. Re-pick them (node survey.js) after gameplay changes.
const DEG = Math.PI / 180;

module.exports = {
  SEED: 101,
  /** The bot lets the flamingo tip over here, then saves it with a flap (a "nice save") */
  DRAMA: [{ t0: 13.0, t1: 13.9, target: 64 * DEG }],
  /** Screenshots: [file name, sim time]. 6-skins and 7-start are menu screens. */
  SHOTS: [
    ['1-balance', 13.9],
    ['2-crab', 73.6],
    ['3-chicks', 126.6],
    ['4-fever', 101.75],
    ['5-gull', 153.7],
  ],
  SHOT_NAMES: ['1-balance', '2-crab', '3-chicks', '4-fever', '5-gull', '6-skins', '7-start'],
  /** Preview video clips: [start, end]. Clip N carries caption N. */
  CLIPS: [
    [11.9, 16.7],
    [71.3, 76.1],
    [91.3, 95.9],
    [100.2, 105.7],
    [152.0, 156.4],
  ],
  /** Center of the PLAY button at 956x440 (it keeps its place in every language) */
  PLAY: [698, 255],
};
