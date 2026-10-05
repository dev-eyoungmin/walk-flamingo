/**
 * Runs inside the page and plays the real game through its normal inputs (1 = left, 2 = right,
 * 3 = flap). It balances, braces against rocks, leans out from under branches, flaps gulls away
 * and follows `__drama`, a list of scripted leans ({ t0, t1, target }) in simulation time.
 */
module.exports = function installBot() {
  const DEG = Math.PI / 180;
  const g = globalThis;
  g.__drama = g.__drama || [];
  let flapHold = 0;
  g.__wobbyBot = (s) => {
    let target = 0;
    let wantFlap = false;
    const o = s.obs;
    const stage = s.evStage;
    if (stage !== 0 && s.evType === 0) {
      if (s.evSub === 0) {
        if (o[0] < 0.5 || o[7] < 0.5) target = -s.evDir * 11 * DEG; // brace against the rock
      } else if (s.evSub === 1) {
        if (stage === 1 || (o[0] > 0.5 && o[7] < 0.5)) target = -s.evDir * 19 * DEG; // out from under the branch
      } else if (s.evSub === 2) {
        if (o[0] > 0.5 && o[7] > 0.5 && o[7] < 1.5 && o[10] > 0.5) wantFlap = true; // shoo the gull
      }
    } else if (stage !== 0 && s.evType === 2 && s.evSub === 2) {
      target = s.evDir * 16 * DEG; // lean challenge
    }
    for (const d of g.__drama) if (s.t >= d.t0 && s.t < d.t1) target = d.target;
    // Emergency flap
    if (Math.abs(s.angle) > 50 * DEG && s.angle * s.omega > 0 && target === 0) wantFlap = true;
    if (flapHold > 0) {
      flapHold--;
      return 0;
    }
    if (wantFlap && s.flapCooldown <= 0 && (s.prevInput & 3) !== 3) {
      flapHold = 6; // release for a few frames after the tap
      return 3;
    }
    const e = s.angle - target + 0.22 * s.omega;
    if (e > 0.015) return 1;
    if (e < -0.015) return 2;
    return 0;
  };
};
