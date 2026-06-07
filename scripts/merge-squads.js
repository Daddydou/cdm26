const part1 = require('../app/scripts/data/worldcup-squads-part1.json')
const part2 = require('../app/scripts/data/worldcup-squads-part2.json')
const part3 = require('../app/scripts/data/worldcup-squads-part3.json')
const merged = { ...part1, ...part2, ...part3 }
require('fs').writeFileSync('./app/scripts/data/worldcup-squads.json', JSON.stringify(merged, null, 2))
console.log('Fusionné :', Object.keys(merged).length, 'nations')
