import { describe, expect, it } from 'vitest';
import { cityMap } from './cityMap.ts';
import { loadGameData } from './worldData.ts';

describe('city map', () => {
  it('has a real outline and a label inside the viewbox for every district', () => {
    const map = cityMap();
    const [x, y, w, h] = map.viewbox;
    for (const d of loadGameData().world.districts) {
      const shape = map.districts[d.id];
      expect(shape, d.id).toBeDefined();
      expect(shape!.path.startsWith('M')).toBe(true);
      expect(shape!.label[0]).toBeGreaterThan(x);
      expect(shape!.label[0]).toBeLessThan(x + w);
      expect(shape!.label[1]).toBeGreaterThan(y);
      expect(shape!.label[1]).toBeLessThan(y + h);
    }
    expect(map.water.length).toBeGreaterThan(0);
    expect(map.attribution).toMatch(/Philadelphia/);
  });
});
