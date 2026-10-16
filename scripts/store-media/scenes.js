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
    ['2-crab', 72.5],
    ['3-chicks', 126.6],
    ['4-fever', 101.75],
    ['5-gull', 192.9],
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
  /**
   * Capture viewports. `canvas` is the App Store screenshot size, `frame` the game shot inside it
   * (it runs off the bottom edge, cropping the empty strip under the controls).
   */
  DEVICES: {
    iphone: { width: 956, height: 440, dsf: 3, folder: 'APP_IPHONE_67', canvas: [2868, 1320], caption: 262, frame: [2540, 1169] },
    ipad: { width: 1180, height: 885, dsf: 2, folder: 'APP_IPAD_PRO_3GEN_129', canvas: [2752, 2064], caption: 300, frame: [2400, 1800] },
  },
};
