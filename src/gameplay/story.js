import * as THREE from 'three';
import { LANDMARKS as L } from '../world/city.js';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
// Campaign data: "Two Webs, One City"
export const CAMPAIGN = [
  { id: 'm1', title: 'Night Shift', desc: 'Ali patrols Midtown and runs into a Warden supply run.', hero: 'ali', time: 21, steps: [
    { type: 'say', cine: L.empire.clone().setY(120), lines: [['ali', 'Manhattan, 9 PM. Perfect night for a swing.', 3], ['mj', 'Ali, it\'s Maya. Police scanner says armed crews are moving crates near Times Square.', 4], ['ali', 'Crates? At night? Totally not suspicious. On it.', 3]] },
    { type: 'goto', pos: L.timesSquare, radius: 30, text: 'Swing to Times Square (hold SHIFT in the air)', checkpoint: true },
    { type: 'fight', pos: L.timesSquare, waves: [['thug', 'thug', 'thug', 'gunner']], text: 'Stop the Warden crew (LMB attack · F dodge on the cue)' },
    { type: 'say', lines: [['ali', 'These guys have Warden tech. Drone parts, plasma cells...', 3], ['mj', 'The Warden? The guy who bought half the Financial District?', 3.5], ['ali', 'Yep. And someone just ran off with a crate. Following.', 3]] },
    { type: 'fight', pos: L.chrysler, roof: true, waves: [['thug', 'gunner', 'gunner'], ['brute', 'thug']], text: 'Chase the crate to the Chrysler rooftops and take them down', checkpoint: true },
    { type: 'say', lines: [['ali', 'Crate secured. Huh... it\'s empty. Just black goo residue.', 3.5], ['mj', 'Get some sleep, hero. Your brother\'s been calling.', 3]] },
  ] },
  { id: 'm2', title: 'Big Brother', desc: 'Majed Juma returns to the city. Two Spider-Men, one team.', hero: 'majed', time: 7, steps: [
    { type: 'playAs', hero: 'majed' },
    { type: 'say', cine: L.jumaHome.clone().setY(60), lines: [['majed', 'Three years in Cairo, and Ali still leaves the fridge open.', 3.5], ['ali', '(radio) Majed! You\'re back! Did you bring the suit?', 3], ['majed', 'I brought a better suit. Ironsilk. Meet me at the docks — Warden\'s smuggling boats.', 4]] },
    { type: 'goto', pos: L.dock, radius: 40, text: 'Swing to the West Side docks as Majed', checkpoint: true },
    { type: 'fight', pos: L.dock, waves: [['thug', 'thug', 'shield', 'shield'], ['brute', 'gunner', 'gunner']], text: 'Clear the docks (Shields: attack from the air or behind)' },
    { type: 'say', lines: [['majed', 'Ali, your turn. They\'re loading a truck in the Village.', 3], ['ali', 'Finally! Tag me in!', 2.5]] },
    { type: 'switchPrompt', to: 'ali', text: 'Press TAB to switch to Ali' },
    { type: 'fight', pos: L.village, waves: [['thug', 'thug', 'gunner', 'jetpack']], text: 'Wreck the Village convoy as Ali', checkpoint: true },
    { type: 'say', lines: [['ali', 'Brothers are back in business!', 2.5], ['majed', 'Don\'t get cocky. Someone\'s paying these crews a fortune.', 3.5]] },
  ] },
  { id: 'm3', title: 'Carapace', desc: 'The Warden\'s armored enforcer wants the Spider-Men gone.', hero: 'majed', time: 16, steps: [
    { type: 'say', lines: [['news', 'Breaking: an armored figure is tearing through the Financial District!', 3.5], ['majed', 'That\'s Carapace. Ex-military. Nearly unbreakable.', 3], ['ali', 'Nearly is my favorite word.', 2.5]] },
    { type: 'goto', pos: L.fidi, radius: 35, text: 'Get to the Financial District', checkpoint: true },
    { type: 'fight', pos: L.fidi, waves: [['thug', 'thug', 'gunner', 'shield']], text: 'Deal with Carapace\'s escort' },
    { type: 'say', lines: [['carapace', 'Two spiders. The Warden pays double for a matching pair.', 3.5], ['majed', 'Tip: bait his charge into a wall, then hit him hard.', 3.5]] },
    { type: 'boss', type2: 'carapace', pos: L.fidi, text: 'Defeat CARAPACE — dodge his charges into walls, web him (Q) to stun', checkpoint: true },
    { type: 'say', lines: [['carapace', 'You... don\'t know... what the Warden found in the park...', 3.5], ['ali', 'Found? Found what?!', 2]] },
  ] },
  { id: 'm4', title: 'Black Rain', desc: 'Something fell into Central Park. It is hungry.', hero: 'ali', time: 23, weather: 'rain', steps: [
    { type: 'say', cine: L.park.clone().setY(80), lines: [['news', 'A meteor has struck Central Park. Residents report... screaming shadows.', 4], ['ali', 'Majed, you seeing this?', 2], ['majed', 'Heading there now. Be careful.', 2.5]] },
    { type: 'goto', pos: L.park, radius: 45, text: 'Investigate the crater in Central Park', checkpoint: true },
    { type: 'fight', pos: L.park, waves: [['symbiote', 'symbiote', 'thug', 'thug'], ['symbiote', 'symbiote', 'symbiote']], text: 'Fight the symbiote hosts — finishers (X) keep them down' },
    { type: 'say', lines: [['symbiote', '...strong one... protector... WE want you...', 3.5], ['majed', 'Ali — something\'s on me! It\'s... it\'s in my head!', 3.5], ['ali', 'MAJED!', 1.5]] },
  ] },
  { id: 'm5', title: 'Bonded', desc: 'Majed fights the symbiote as it runs wild across Midtown.', hero: 'ali', time: 1, weather: 'rain', steps: [
    { type: 'say', lines: [['mj', 'Ali, a black Spider-Man is tearing across rooftops toward Midtown!', 3.5], ['ali', 'That\'s my brother. I\'m bringing him home.', 3]] },
    { type: 'chase', path: [L.park.clone().setY(40), v(96, 90, -560), v(0, 110, -420), L.chrysler.clone().setY(210), L.empire.clone().setY(140), v(-192, 80, -60)], speed: 30, text: 'Chase Venom — stay close!', checkpoint: true },
    { type: 'say', lines: [['venom', 'Little brother. WE are stronger now. WE don\'t need you.', 3.5], ['ali', 'Majed, fight it! It\'s using you!', 3]] },
    { type: 'boss', type2: 'venomBoss', pos: v(-192, 0, -60), hpMul: 0.5, text: 'Knock the symbiote off balance — survive VENOM', checkpoint: true },
    { type: 'say', lines: [['venom', 'Enough... Majed is ... OURS. Hahaha...', 3], ['ali', 'He got away. Maya, I need the Warden\'s address. Now.', 3.5]] },
  ] },
  { id: 'm6', title: 'The Warden\'s Tower', desc: 'Infiltrate the Warden\'s tower and learn what he wants with the symbiote.', hero: 'ali', time: 3, steps: [
    { type: 'goto', pos: L.wardenTower, radius: 60, text: 'Approach the Warden\'s Tower', checkpoint: true },
    { type: 'say', lines: [['mj', 'Rooftop guards. Stay out of sight — perch takedowns (E) and takedowns from behind (LMB).', 4]] },
    { type: 'fight', pos: L.wardenTower, roof: 'near', stealth: true, waves: [['thug', 'gunner', 'thug', 'gunner', 'shield']], text: 'Stealth: clear the lower rooftops unseen' },
    { type: 'say', lines: [['warden', 'Ali Juma. Your brother\'s symbiote will make my army unstoppable.', 4], ['ali', 'Tall words for a guy hiding in a robot.', 2.5], ['warden', 'Then come meet the robot.', 2.5]] },
    { type: 'boss', type2: 'warden', pos: L.fidi.clone().add(v(-96, 0, -150)), text: 'Destroy THE WARDEN\'s mech — dodge missiles, drop the jet troopers', checkpoint: true },
    { type: 'say', lines: [['warden', 'You\'re too late... I already sent the signal. It will make him FEAST.', 4], ['ali', 'Majed...', 2]] },
  ] },
  { id: 'm7', title: 'Hungry', desc: 'Play as Venom. The Warden\'s army descends on Times Square.', hero: 'venom', time: 22, steps: [
    { type: 'playAs', hero: 'venom' },
    { type: 'say', cine: L.timesSquare.clone().setY(50), lines: [['venom', 'The Warden\'s signal... it BURNS. WE will tear his soldiers apart.', 4], ['majed', '(inside) Not civilians. Only them. PROMISE me.', 3], ['venom', '...Fine. Only THEM.', 2.5]] },
    { type: 'goto', pos: L.timesSquare, radius: 35, text: 'Leap to Times Square (SHIFT in the air: tendril pull)', checkpoint: true },
    { type: 'fight', pos: L.timesSquare, waves: [['thug', 'thug', 'thug', 'shield', 'gunner', 'gunner'], ['brute', 'brute', 'jetpack', 'jetpack'], ['shield', 'shield', 'brute', 'gunner', 'gunner', 'thug']], text: 'RAMPAGE: E grab & throw · 1 Tendril Storm · 2 Surge · 3 Roar' },
    { type: 'say', lines: [['venom', 'More... WE want MORE...', 2.5], ['majed', 'No! Ali\'s coming. Let me go!', 3], ['venom', 'Then let him come to the bridge.', 3]] },
  ] },
  { id: 'm8', title: 'Brothers', desc: 'The final battle on the bridge. Save Majed.', hero: 'ali', time: 5.6, steps: [
    { type: 'playAs', hero: 'ali' },
    { type: 'say', cine: L.bridge.clone().setY(60), lines: [['ali', 'Sunrise on the bridge. Majed always loved this view.', 3.5], ['mj', 'Ali... the symbiote hates sound and electricity. Your Volt suit could burn it off him.', 4.5]] },
    { type: 'goto', pos: L.bridge, radius: 40, text: 'Reach the bridge', checkpoint: true },
    { type: 'boss', type2: 'venomBoss', pos: L.bridge.clone().add(v(40, 0, 0)), text: 'Defeat VENOM — use Arc Lash (1) and Static Dome (2)!', checkpoint: true },
    { type: 'say', cine: L.bridge.clone().setY(40), lines: [['venom', 'WE... are... Majed...', 2.5], ['ali', 'No. You\'re my brother. Come back, Majed!', 3], ['majed', 'Ali... I\'m here. I\'ve got it under control now. It listens to me.', 4], ['venom', '...WE will protect this city. Together.', 3.5], ['ali', 'Oh great. Now there\'s three of us.', 3]] },
    { type: 'unlockVenom' },
    { type: 'say', lines: [['mj', 'Campaign complete! Venom is now playable in free roam — press V. Crimes, bases, challenges and Juma Memories await.', 6]] },
  ] },
];
