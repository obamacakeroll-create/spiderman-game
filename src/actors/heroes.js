// Hero definitions: identity, stats, abilities, skill trees.
export const HERO_DEFS = {
  ali: {
    id: 'ali', name: 'Ali Juma', title: 'Volt Weaver', color: '#18e0ff', traversal: 'web', suit: 'ali_volt', scale: 1, bulk: 0.95, body: { muscle: 1.0, waist: 0.88, head: 1 },
    bio: 'Quick-witted, reckless, brilliant with tech. Channels bio-electric venom through his webs.',
    stats: { hp: 100, run: 10, sprint: 17, jump: 13, pump: 1.15, maxSwing: 58, dmg: 1.0, comboSpeed: 1.2, air: 1.2 },
    abilities: [
      { id: 'arc', name: 'Arc Lash', key: '1', cd: 8, desc: 'Chain lightning web jumps between up to 5 enemies.' },
      { id: 'dome', name: 'Static Dome', key: '2', cd: 14, desc: 'Electric burst stuns and launches everyone nearby.' },
      { id: 'overclock', name: 'Overclock', key: '3', cd: 25, desc: '10s of hyper speed, double damage and electric trails.' },
    ],
    lines: { switchIn: ['Ali in. Let\'s make some noise!', 'My turn, big bro!', 'Volt Weaver, online.'], kill: ['Shocking, right?', 'Zap and nap!', 'That one\'s gonna leave a mark.'], trick: ['Wooo!', 'Ten out of ten!'] },
  },
  majed: {
    id: 'majed', name: 'Majed Juma', title: 'Ironsilk', color: '#ff4a4a', traversal: 'web', suit: 'majed_iron', scale: 1.04, bulk: 1.1, body: { muscle: 1.15, waist: 0.95, head: 1 },
    bio: 'The older brother. Methodical, protective, hits like a freight train. Reinforced silk and seismic gauntlets.',
    stats: { hp: 130, run: 9.5, sprint: 16, jump: 12, pump: 1.0, maxSwing: 54, dmg: 1.35, comboSpeed: 0.95, air: 1.0 },
    abilities: [
      { id: 'seismic', name: 'Seismic Drop', key: '1', cd: 9, desc: 'Leap and slam: shockwave launches enemies.' },
      { id: 'hammer', name: 'Web Hammer', key: '2', cd: 12, desc: 'Bind nearby enemies and swing them as a wrecking ball.' },
      { id: 'guardian', name: 'Guardian Wall', key: '3', cd: 22, desc: 'Silk shield: 70% damage reduction, reflects bullets.' },
    ],
    lines: { switchIn: ['Majed here. I\'ve got it.', 'Stay focused, Ali. I\'m taking over.', 'Ironsilk, moving in.'], kill: ['Stay down.', 'Should\'ve surrendered.', 'Next.'], trick: ['Not bad.', 'Still got it.'] },
  },
  venom: {
    id: 'venom', name: 'Venom', title: 'The Hunger', color: '#b08cff', traversal: 'symbiote', suit: 'venom', scale: 1.42, bulk: 1.3, body: { muscle: 1.4, waist: 0.72, head: 1.12, venom: true },
    bio: 'An alien symbiote bonded to Majed. Unstoppable, starving, and learning what it means to protect.',
    stats: { hp: 240, run: 11, sprint: 20, jump: 22, pump: 1.0, maxSwing: 62, dmg: 2.1, comboSpeed: 0.9, air: 0.8 },
    abilities: [
      { id: 'whirl', name: 'Tendril Storm', key: '1', cd: 7, desc: 'Tendrils lash in every direction.' },
      { id: 'surge', name: 'Symbiote Surge', key: '2', cd: 12, desc: 'Spikes erupt from the ground, launching everything.' },
      { id: 'roar', name: 'Roar', key: '3', cd: 18, desc: 'Terrifying roar stuns enemies and heals Venom.' },
    ],
    lines: { switchIn: ['WE are hungry.', 'Let US out.', 'Fresh meat...'], kill: ['Delicious.', 'WE are Venom!', 'More!'], trick: ['Hahaha!'] },
  },
};

export const SKILL_TREES = {
  ali: [
    { branch: 'Traversal', nodes: [
      { id: 'a_swing1', name: 'Charged Lines', desc: '+10% max swing speed', cost: 1, mod: { maxSwing: 0.1 } },
      { id: 'a_swing2', name: 'Slingshot Release', desc: '+40% release boost', cost: 1, mod: { release: 0.4 } },
      { id: 'a_zip', name: 'Lightning Zip', desc: '+50% zip speed & point launch', cost: 2, mod: { zip: 0.5 } },
    ] },
    { branch: 'Volt', nodes: [
      { id: 'a_arc', name: 'Longer Arcs', desc: 'Arc Lash hits 3 more enemies', cost: 1, mod: { arc: 3 } },
      { id: 'a_cd', name: 'Capacitor', desc: '-25% ability cooldowns', cost: 2, mod: { cd: 0.25 } },
      { id: 'a_focus', name: 'Feedback Loop', desc: '+40% focus gain', cost: 2, mod: { focus: 0.4 } },
    ] },
    { branch: 'Acrobat', nodes: [
      { id: 'a_air', name: 'Sky Combo', desc: 'Air combos deal +30% damage', cost: 1, mod: { airDmg: 0.3 } },
      { id: 'a_dodge', name: 'Perfect Timing', desc: 'Wider perfect dodge window', cost: 1, mod: { dodge: 0.1 } },
      { id: 'a_hp', name: 'Bounce Back', desc: '+25 max health', cost: 2, mod: { hp: 25 } },
    ] },
  ],
  majed: [
    { branch: 'Brawler', nodes: [
      { id: 'm_dmg', name: 'Iron Knuckles', desc: '+20% melee damage', cost: 1, mod: { dmg: 0.2 } },
      { id: 'm_heavy', name: 'Aftershock', desc: 'Combo finishers cause shockwaves', cost: 2, mod: { aftershock: 1 } },
      { id: 'm_hp', name: 'Thick Skin', desc: '+40 max health', cost: 2, mod: { hp: 40 } },
    ] },
    { branch: 'Guardian', nodes: [
      { id: 'm_cd', name: 'Disciplined', desc: '-25% ability cooldowns', cost: 1, mod: { cd: 0.25 } },
      { id: 'm_heal', name: 'Second Wind', desc: 'Finishers heal 25 HP', cost: 2, mod: { finHeal: 25 } },
      { id: 'm_focus', name: 'Steady Breath', desc: '+40% focus gain', cost: 1, mod: { focus: 0.4 } },
    ] },
    { branch: 'Traversal', nodes: [
      { id: 'm_swing', name: 'Heavy Momentum', desc: '+12% max swing speed', cost: 1, mod: { maxSwing: 0.12 } },
      { id: 'm_dive', name: 'Meteor Dive', desc: 'Dive landings damage enemies', cost: 1, mod: { meteor: 1 } },
      { id: 'm_release', name: 'Power Release', desc: '+40% release boost', cost: 2, mod: { release: 0.4 } },
    ] },
  ],
};
