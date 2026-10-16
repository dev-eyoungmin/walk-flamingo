import { ghostMetersAt, validGhost } from './ghost';
describe('daily distance ghost', () => {
  it('interpolates samples and waits at the finish', () => {
    expect(ghostMetersAt([0,1,2,3],0.75)).toBe(1.5);
    expect(ghostMetersAt([0,1,2,3],99)).toBe(3);
    expect(ghostMetersAt([],1)).toBe(0);
    expect(ghostMetersAt([0,1],-1)).toBe(0);
  });
  it('rejects another day, invalid numbers and nonmonotonic traces', () => {
    expect(validGhost({seed:7,meters:3,trace:[0,1,2,3]},7)).toBe(true);
    expect(validGhost({seed:6,meters:3,trace:[0,1,2,3]},7)).toBe(false);
    expect(validGhost({seed:7,meters:3,trace:[0,NaN]},7)).toBe(false);
    expect(validGhost({seed:7,meters:3,trace:[0,2,1]},7)).toBe(false);
    expect(validGhost({seed:7,meters:3,trace:[1,2]},7)).toBe(false);
  });
});
