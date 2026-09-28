import { SKILL_TREES } from '../actors/heroes.js';
import { SUITS } from '../actors/rig.js';

const KEY = 'juma-brothers-save-v1';
export class Progression {
  constructor(G) { this.G = G; this.reset(); }
  reset() {
    this.s = { level: 1, xp: 0, sp: 0, skills: [], suits: { ali: 'ali_volt', majed: 'majed_iron', venom: 'venom' }, mission: 0, step: 0, collect: [], crimes: 0, challenges: {}, bases: [], venomUnlocked: false, tokens: 0, hero: 'ali', freeRoam: false };
  }
  load() { try { const d = JSON.parse(localStorage.getItem(KEY)); if (d) { this.reset(); Object.assign(this.s, d); return true; } } catch (e) { } return false; }
  hasSave() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.s)); } catch (e) { } }
  xpFor(l) { return 300 + l * 250; }
  addXP(n) {
    const s = this.s; s.xp += n;
    while (s.xp >= this.xpFor(s.level)) { s.xp -= this.xpFor(s.level); s.level++; s.sp++; this.G.hud.notify(`LEVEL UP — ${s.level}  (+1 skill point, press ESC)`, true); this.G.audio.chime(); this.checkSuits(); }
  }
  checkSuits() { for (const [id, su] of Object.entries(SUITS)) if (su.level === this.s.level && su.hero !== 'venom') this.G.hud.notify(`New suit unlocked: ${su.name}`, true); }
  suitUnlocked(id) { return SUITS[id].level <= this.s.level || this.s.freeRoam; }
  abilityUnlocked(hero, i) { return this.s.freeRoam || hero === 'venom' || this.s.level >= i * 2 + 1; }
  buy(id) {
    const node = Object.values(SKILL_TREES).flat().flatMap(b => b.nodes).find(n => n.id === id);
    if (!node || this.s.skills.includes(id) || this.s.sp < node.cost) return false;
    this.s.sp -= node.cost; this.s.skills.push(id); this.save(); return true;
  }
  mod(hero, key) {
    const tree = SKILL_TREES[hero]; if (!tree) return 0; let v = 0;
    for (const b of tree) for (const n of b.nodes) if (this.s.skills.includes(n.id) && n.mod[key]) v += n.mod[key];
    return v;
  }
}
