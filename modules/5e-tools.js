// TODO: remake everything with https://github.com/TheGiddyLimit/TheGiddyLimit.github.io
const Discord = require('discord.js')
//const fetch = require('node-fetch')
const fs = require('fs/promises')
const elasticlunr = require('elasticlunr')
const TextTable = require('text-table')
const log = require('../lib/logger')
const { getStore } = require('../lib/util')

elasticlunr.clearStopWords()

const APIData = getStore('5e-api-data', {})
const MetaData = {}

async function fetchdata(json, dir='data', subkey) {
  const path = '/'+dir+json
  if (!APIData[path]) {
    const base =  './data/5e-tools' //'file://${BASE_DIR}/data/5e-tools' //'https://5e.tools'
    const fetched = await fs.readFile(`${base}${path}.json`, {encoding:'utf8'})
    const resp = await JSON.parse(fetched)
    if (subkey)
      APIData[path] = resp[subkey]
    else
      APIData[path] = resp
  }
  return APIData[path]
}

const COLOR = '#006bc4'
const ICON = 'https://a.pomf.cat/oyqpeg.png'

const CATEGORY_TO_DATA = {
  "1": { full:"Bestiary", url:"bestiary.html" },
  "2": { full:"Spell", url:"spells.html" },
  "3": { full:"Background", url:"backgrounds.html" },
  "4": { full:"Item", url:"items.html" },
  "5": { full:"Class", url:"classes.html" },
  "6": { full:"Condition", url:"conditionsdiseases.html" },
  "7": { full:"Feat", url:"feats.html" },
  "8": { full:"Eldritch Invocation", url:"optionalfeatures.html" },
  "9": { full:"Psionic", url:"psionics.html" },
  "10": { full:"Race", url:"races.html" },
  "11": { full:"Other Reward", url:"rewards.html" },
  "12": { full:"Variant/Optional Rule", url:"variantrules.html" },
  "13": { full:"Adventure", url:"adventure.html" },
  "14": { full:"Deity", url:"deities.html" },
  "15": { full:"Object", url:"objects.html" },
  "16": { full:"Trap", url:"trapshazards.html" },
  "17": { full:"Hazard", url:"trapshazards.html" },
  "18": { full:"Quick Reference", url:"quickreference.html" },
  "19": { full:"Cult", url:"cultsboons.html" },
  "20": { full:"Boon", url:"cultsboons.html" },
  "21": { full:"Disease", url:"conditionsdiseases.html" },
  "22": { full:"Metamagic", url:"optionalfeatures.html" },
  "23": { full:"Maneuver; Battlemaster", url:"optionalfeatures.html" },
  "24": { full:"Table", url:"tables.html" },
  "25": { full:"Table", url:"tables.html" },
  "26": { full:"Maneuver; Cavalier", url:"optionalfeatures.html" },
  "27": { full:"Arcane Shot", url:"optionalfeatures.html" },
  "28": { full:"Optional Feature", url:"optionalfeatures.html" },
  "29": { full:"Fighting Style", url:"optionalfeatures.html" },
  "30": { full:"Class Feature", url:"classes.html" },
  "31": { full:"Vehicle", url:"vehicles.html" },
  "32": { full:"Pact Boon", url:"optionalfeatures.html" },
  "33": { full:"Elemental Discipline", url:"optionalfeatures.html" },
  "34": { full:"Infusion", url:"optionalfeatures.html" },
  "35": { full:"Ship Upgrade", url:"optionalfeatures.html" },
  "36": { full:"Infernal War Machine Upgrade", url:"optionalfeatures.html" },
  "37": { full:"Rune Knight Rune", url:"optionalfeatures.html" },
  "38": { full:"Alchemical Formula", url:"optionalfeatures.html" },
  "39": { full:"Maneuver", url:"optionalfeatures.html" },
  "40": { full:"Subclass", url:"classes.html" },
  "41": { full:"Subclass Feature", url:"classes.html" },
  "42": { full:"Action", url:"actions.html" }
}

const ABILITY_SHORT_TO_LONG = {
  'str': 'strength',
  'dex': 'dexterity',
  'con': 'constitution',
  'int': 'intelligence',
  'wis': 'wisdom',
  'cha': 'charisma'
}

const SPELL_SCHOOL = {
  'T': 'transmutation',
  'N': 'necromancy',
  'C': 'conjuration',
  'A': 'abjuration',
  'E': 'enchantment',
  'V': 'evocation',
  'I': 'illusion',
  'D': 'divination'
}

const flatten = arr => [].concat(...arr) // .flat()/flatMap() missing in glitch (ES2019)
const ifdefined = s => s ? s+' ' : ''
const capitalize = s => s[0].toUpperCase()+s.slice(1)
const underlineFirst = s => `__${s[0]}__`+s.slice(1)

function nthnumber(n) {
  switch (n % 100) {
  case 1: return n+'st'
  case 2: return n+'nd'
  case 3: return n+'rd'
  case 11:
  case 12:
  case 13:
    return n+'th'
  default: {
    const N = Math.abs(n) % 10
    if (N < 4 && N !== 0)
      return n.toString().slice(0,-1) + nthnumber(N % 10)
    else
      return n+'th'
  }
  }
}

function englist(lst, conjunction='or') {
  switch(lst.length) {
  case 1:
    return lst[0]
  case 2:
    return lst[0]+` ${conjunction} `+lst[1]
  default:
    return lst.slice(0, lst.length-1).join(', ') + `, ${conjunction} ${lst[lst.length-1]}`
  }
}

function isNotHomebrew(sourcable) {
  const s = sourcable.source
  if (sourcable.isReprinted)
    return false
  return s && !(s.startsWith('UA') ||
                s === 'Stream' ||
                s === 'Twitter' ||
                s === 'PSA')
}

function regexpSearch(docs, query, name='name') {
  const re = new RegExp('^'+query+'$', 'i')
  return docs.find(d => re.exec(d[name]))
}

function lunrSearch(docs, index, query, options) {
  if (!options)
    options = {
      fields: {
        name: { boost: 2 },
        entries: { boost: 1 }
      },
      expand: true
    }
  const results = index.search(query, options)
  if (results.length === 0)
    return 'no results found'
  return new Discord.MessageEmbed()
    .setColor(COLOR)
    .setTitle(`${results.length} Results Found`)
    .setDescription(
      results
        .slice(0, 10)
        .map(({ref}) => docs[parseInt(ref)])
        .map((s, idx) => `${idx+1}. *${s.name}*`)
        .join('\n'))
}

const Format = {
  spell: {
    level: (level, school, meta) => {
      if (level === 0)
        return `${capitalize(SPELL_SCHOOL[school])} cantrip`
      return `${nthnumber(level)}-level ${SPELL_SCHOOL[school]}`
        + ((meta && meta.ritual) ? ' (ritual)' : '')
    },
    components: c => {
      let comp = []
      if (c.v) comp.push('V')
      if (c.s) comp.push('S')
      if (c.m) comp.push(`M (${c.m.text || c.m})`)
      return comp.join(', ')
    },
    duration: d => {
      switch (d.type) {
      case 'timed': {
        const concentration = d.concentration ? 'Concentration, up to ' : ''
        return concentration + d.duration.amount.toString() +' '+ d.duration.type
          + (d.duration.amount > 1 ? 's' : '')
      }
      case 'permanent':
        return `Until ${d.ends.map(e => e === 'dispel' ? 'dispelled' : e+'ed').join(' or ')}`
      default:
        return capitalize(d.type)
      }
    },
    classes: classes => {
      if (classes)
        return classes
        .filter(c => !c.source.startsWith('UA'))
        .map(c => `[${c.name}](https://5e.tools/classes.html#${c.name.toLowerCase()}_${c.source.toLowerCase()})`)
        .join(', ')
      return '*None*'
    }
  },
  feat: {
    prerequisite: prereq => {
      return englist(Object.keys(prereq).map(key => {
        const val = prereq[key]
        switch(key) {
        case 'race':
          return englist(val.map(r => {
            if (r.displayEntry)
              return r.displayEntry
            const subrace = r.subrace ? ` (${r.subrace})` : ''
            return capitalize(r.name) + subrace
          }))
        case 'ability': {
          let num
          return englist(val.map(a => {
            const ability = [a.keys()[0]]
            num = a.keys()[0]
            return capitalize(ABILITY_SHORT_TO_LONG[ability])
          }))+` ${num} or higher`
        }
        case 'spellcasting':
          return 'The ability to cast at least one spell'
        case 'proficiency':
          return 'Proficiency with ' + englist(val.map(p => `${Object.values(p)[0]} ${Object.keys(p)[0]}`))
        case 'other':
        default:
          return val
        }
      }))
    }
  },
  'class': {
    featureListing: (start, end, cls) =>
      cls.classFeatures.slice(start, end)
      .map((l, level) => l.length ? l
           .filter(f => !(f.source && f.source.startsWith('UA')))
           .map((f, idx) => `[${f.name}](https://5e.tools/classes.html#${cls.name.toLowerCase()}_${cls.source.toLowerCase()},state:feature=s${level+start}-${idx})`)
           .join(', ')
           : '—')
      .join('\n'),
    proficiencies: profs => {
      return Object.keys(profs).map(prof => {
        const val = profs[prof]
        switch(prof) {
        case 'armor': {
          const shield = val.find(x => x === 'shields' || x.proficiency === 'shields')
          const armors = val.filter(x => x !== 'shields' && typeof x === 'string').map(x => x+' armor')

          return '**Armor**: ' +
            (shield
            ? armors.concat(shield).join(', ')
            : armors.join(', '))
        }
        case 'weapons':
          return '**Weapons**: '
            + val.map(w => (w === 'simple' || w === 'martial')
                      ? w + ' weapons' : w).join(', ')
        case 'tools':
          return '**Tools**: '+val.join(', ')
        case 'saving_throws':
          return '**Saving Throws**: ' + val.map(a => capitalize(ABILITY_SHORT_TO_LONG[a])).join(', ')
        case 'skills': {
          const choose = val[0].choose
          return `**Skills**: Choose ${choose.count} from `
            + englist(choose.from.map(s => capitalize(s)), 'and')
        }
        default:
          log.warn('unimplemented proficiency', prof)
        }
      }).join('\n')
    },
    startingEquipment: equipment => {
      let str = 'You start with the following items'

      if (equipment.additionalFromBackground)
        str += ', plus anything provided by your background.\n'
      else
        str += '.\n'

      for (const entry of equipment.default)
        str += '• '+markup(entry)+'\n'

      str += `Alternatively, you may start with ${markup(equipment.goldAlternative)} gp to buy your own equipment.`

      return str
    },
    multiclassing: reqs => {
      const { requirements, proficienciesGained } = reqs
      let string = `**Ability Score Minimum**: `
      if (requirements.or)
        string += englist(Object.keys(requirements.or[0]).map(score => `${capitalize(ABILITY_SHORT_TO_LONG[score])} ${requirements.or[0][score]}`))
      else
        string += Object.keys(requirements).map(score => `${capitalize(ABILITY_SHORT_TO_LONG[score])} ${requirements[score]}`).join(', ')

      if (proficienciesGained)
        string += '\n\n' + Format.class.proficiencies(proficienciesGained)

      return string
    },
    classFeatureByName: cls => {
      const scfeats = cls.subclasses
            .filter(x => !x.isReprinted)
            .map(subclass => subclass.subclassFeatures
                 .map(f => f[0].name
                      ? Object.assign({}, f[0], { type:'entries', source: subclass.source })
                      : f[0].entries.map(x => Object.assign({}, x, { source: subclass.source })))
                 .flat()).flat()
      const features = cls.classFeatures.flat()
            .map(e => e.type ? e : Object.assign({}, e, { type: 'entries' }))
            .concat(scfeats)
      return features
    },
  },
  action: {
    time: times => {
      if (times) return times
        .map(t => typeof t === 'string' ? t : `${t.number} ${t.unit}`)
        .join('/')
      else return '—'
    },
    line: (a, idx) => {
      let str = `\`${idx+1}.\` ${a.name}`
      if (a.fromVariant)
        str += ` *(Variant: ${a.fromVariant})*`
      return str
    }
  }
}

function markup(str) {
  const id = ([x]) => x
  const ud = ([x]) => `__${x}__`
  const lastarg = lst => lst[lst.length-1]
  const replace = {
    i: ([s]) => `*${s}*`,
    dice: ([b, a]) => a || b,
    action: id,
    damage: id,
    scaledice: lastarg,
    scaledamage: lastarg,
    skill: ud,
    book: ([display, source, _chapter]) => `[${display}](https://5e.tools/book.html#${source},10)`,
    condition: ([cond]) => `[${cond}](https://5e.tools/conditionsdiseases.html#${cond}_phb)`,
    item: ([name, source, display]) =>
      `[${display || name}](https://5e.tools/items.html#${encodeURIComponent(name)}_${source})` ,
    chance: ([percent]) => `${percent} percent`,
    filter: ([display, link]) => `[${display}](https://5e.tools/${link}.html)`,
    // not necessarily going to work
    spell: ([spell]) => `[${spell}](https://5e.tools/spells.html#${encodeURIComponent(spell)}_phb)`,
    creature: ([mob]) => `[${mob}](https://5e.tools/bestiary.html#${encodeURIComponent(mob)}_mm)`,
  }

  return str.replace(/\{@\w+ .*?\}/g, m => {
    const [_, tag, val] = /\{@(\w+) (.*?)\}/.exec(m)
    if (replace[tag])
      return replace[tag](val.split('|'))
    return m
  })
}

function entries(entr) {
  return flatten(entr.map(e => {
    switch (e.type) {
    case 'options':
      e.entries = e.entries.filter(isNotHomebrew)
      break
    case 'entries': {
      const subentries = entries(e.entries)
      subentries[0] = `***${e.name}.*** ${subentries[0]}`
      return subentries
    }
    case 'list': return e.items.map(i => '• '+markup(i))
    case 'table': {
      const table = TextTable([e.colLabels, []].concat(e.rows.map(col => col.map(str => {
        return str.replace(/\{@\w+ .*?\}/g, m => {
          let [_, tag, val] = /\{@(\w+) (.*?)\}/.exec(m)
          return val.split('|')[0]
        })
      }))))
      return { name: e.caption, value: '```\n'+table+'```' }
    }
    case 'abilityDc':
      return `**${e.name} save DC** = 8 + your proficiency bonus + your ${ABILITY_SHORT_TO_LONG[e.attributes[0]]} modifier`
    case 'abilityAttackMod':
      return `**${e.name} save DC** = your proficiency bonus + your ${ABILITY_SHORT_TO_LONG[e.attributes[0]]} modifier`
    case 'inset':
    case 'quote':
      return ''
    default:
      if (typeof e !== 'string')
        log.warn('5e-tools.js@entries: unimplemented type', e.type, e)
      return markup(e)
    }
  }))
}

function chunkEntries(list) {
  let col = []
  let cur = ''
  while (list.length > 0) {
    if (typeof list[0] !== 'string') {
      if (cur.length > 0)
        col.push(cur)
      col.push(list.shift())
    } else if (list[0].length > 1024) {
      col.push(list[0].slice(0,1023)+'…')
      list[0] = '…'+list[0].slice(1024)
    } else if ((cur+list[0]).length > 1024) {
      col.push(cur)
      cur = ''
    } else {
      if (cur.length > 0)
        cur = cur+'\n\n'
      cur = cur+list.shift()
    }
  }
  if (cur.length > 0)
    col.push(cur)

  return col
}

function embedEntries(embed, entr) {
  const chunked = chunkEntries(entries(entr))
  for (const i of chunked) {
    if (typeof i === 'string')
      embed.addField('\u200B', i)
    else
      embed.addField(i.name, i.value)
  }
  return embed
}

const Retrieve = {
  spells: async () => {
    if(!MetaData.spells) {
      const spells = (await Promise.all(
        [fetchdata('/spells/spells-phb', undefined, 'spell'),
         fetchdata('/spells/spells-xge', undefined, 'spell'),
         fetchdata('/spells/spells-egw', undefined, 'spell'),
         fetchdata('/spells/spells-tce', undefined, 'spell')])).flat()
      MetaData.spells = {
        spells,
        index: elasticlunr(function() {
          this.addField('name')
          this.addField('entries')
          this.setRef('id')
          spells.forEach((d, idx) => {
            d.id = idx
            this.addDoc(d)
          })
        })
      }
    }
    return MetaData.spells
  },
  feats: async () => {
    if (!MetaData.feats) {
      const feats = await fetchdata('/feats', undefined, 'feat')
      MetaData.feats = {
        feats,
        index: elasticlunr(function() {
          this.addField('name')
          this.addField('entries')
          this.setRef('id')
          feats.forEach((d, idx) => {
            d.id = idx
            this.addDoc(d)
          })
        })
      }
    }
    return MetaData.feats
  },
  items: async () => {
    if (!MetaData.items) {
      const items = await fetchdata('/items', undefined, 'item') // ignore itemGroups
      MetaData.items = {
        items,
        index: elasticlunr(function() {
          this.addField('name')
          this.addField('entries')
          this.setRef('id')
          items.forEach((d, idx) => {
            d.id = idx
            this.addDoc(d)
          })
        })
      }
      return MetaData.items
    }
  }
}

const Section = {
  'levels': () => new Discord.MessageEmbed()
    .setColor(COLOR)
    .setTitle('Beyond 1st Level')
    .setFooter('PHB', ICON)
    .setDescription(`\`\`\`
| Lv | Exp.    | Prof. |
|  1 |       0 |    +2 |
|  2 |     300 |    +2 |
|  3 |     900 |    +2 |
|  4 |   2,700 |    +2 |
|  5 |   6,500 |    +3 |
|  6 |  14,000 |    +3 |
|  7 |  23,000 |    +3 |
|  8 |  34,000 |    +3 |
|  9 |  48,000 |    +4 |
| 10 |  64,000 |    +4 |
| 11 |  85,000 |    +4 |
| 12 | 100,000 |    +4 |
| 13 | 120,000 |    +5 |
| 14 | 140,000 |    +5 |
| 15 | 165,000 |    +5 |
| 16 | 195,000 |    +5 |
| 17 | 225,000 |    +6 |
| 18 | 265,000 |    +6 |
| 19 | 305,000 |    +6 |
| 20 | 355,000 |    +6 |
\`\`\``),
  'action': async query => {
    const actions = await fetchdata('/actions', undefined, 'action')
    if (query) {
      query = query.join(' ').toLowerCase()
      const act = regexpSearch(actions, query)
      if (act) {
        const embed = new Discord.MessageEmbed()
              .setColor(COLOR)
              .setTitle(act.name)
              .addField('Time', Format.action.time(act.time), true)
              .setFooter(`${act.source}, pg. ${act.page}`, ICON)
              .setURL(`https://5e.tools/actions.html#${encodeURIComponent(act.name)}_${act.source.toLowerCase()}`)
        if (act.fromVariant)
          embed.addField('Varient', `[${act.fromVariant}](https://5e.tools/variantrules.html#${encodeURIComponent(act.fromVarient)}_${act.source.toLowerCase()})`, true)
        return embedEntries(embed, act.entries)
      }
      return new Discord.MessageEmbed()
        .setColor(COLOR)
        .setTitle('Actions')
        .setFooter('5e.tools', ICON)
        .setURL(`https://5e.tools/actions.html`)
        .setDescription(actions.map(Format.action.line).join('\n'))
    }
  },
  'spell': async query => {
    query = query.join(' ')
    const { spells, index } = await Retrieve.spells()

    const s = regexpSearch(spells, query)
    if (!s)
      return lunrSearch(spells, index, query)

    const embed = new Discord.MessageEmbed()
          .setColor(COLOR)
          .setTitle(s.name)
          .addField('Level', Format.spell.level(s.level, s.school, s.meta), true)
          .addField('Casting Time', s.time.map(t => `${t.number} ${t.unit === 'bonus' ? 'bonus action' : t.unit}${t.number > 1 ? 's' : ''}`).join('\n'), true)
          .addField('Range', ifdefined(s.range.distance.amount)
                    + (s.range.distance.amount ? (x => x) : capitalize)(s.range.distance.type),
                    true)
          .addField('Duration', s.duration.map(Format.spell.duration).join('\n'), true)
          .addField('Components', Format.spell.components(s.components), true)
          .setFooter(`${s.source}, pg. ${s.page}${s.srd ? '—Avaliable in the SRD' : ''}`, ICON)
          .setURL(`https://5e.tools/spells.html#${encodeURIComponent(s.name)}_${s.source.toLowerCase()}`)

    embedEntries(embed, s.entries.concat(s.entriesHigherLevel || []))
    embed.addField('Classes', Format.spell.classes(s.classes.fromClassList))
    return embed
  },
  'feat': async query => {
    query = query.join(' ')
    const { feats, index } = await Retrieve.feats()

    const f = regexpSearch(feats, query)
    if (!f)
      return lunrSearch(feats, index, query)

    const embed = new Discord.MessageEmbed()
          .setColor(COLOR)
          .setTitle(f.name)
          .setDescription(f.prerequisite ? `*Prerequisites: ${englist(f.prerequisite.map(Format.feat.prerequisite))}*` : '')
          .setFooter(`${f.source}, pg. ${f.page}`, ICON)
          .setURL(`https://5e.tools/feats.html#${encodeURIComponent(f.name)}_${f.source.toLowerCase()}`)
    return embedEntries(embed, f.entries)
  },
  'item': async query => {
    query = query.join(' ')
    const { items, index } = await Retrieve.items()
    // const it = regexpSearch(items, query)
    // if (!it)
      return lunrSearch(items, index, query)
  },
  'class': async ([dndclass, ...query]) => {
    if (!dndclass) return 'error: no class provided'
    dndclass = dndclass.toLowerCase()

    const index = await fetchdata('/class/index')
    if (!index[dndclass]) return 'error: unknown class'

    const cls = (await fetchdata(`/class/class-${dndclass}`, undefined, 'class')).find(c => !c.source.startsWith('UA'))

    const embed = new Discord.MessageEmbed()
          .setColor(COLOR)
          .setURL(`https://5e.tools/classes.html#${encodeURIComponent(cls.name)}_${cls.source.toLowerCase()}`)

    // get class information
    if (query.length < 1) {
      for (let level = 1; level < 21; level++)
        embed.addField('Level '+level, Format.class.featureListing(level-1,level,cls), true)

      return embed
        .setTitle(cls.name)
        .setFooter(`${cls.source}`, ICON)
        .addField(`Subclasses (${cls.subclassTitle})`,
                  '• '+cls.subclasses
                  .filter(isNotHomebrew)
                  .map(s => `${s.name} *[${s.source}]*`)
                  .join('\n• '))
        .addField('Hit Points', `**Hit Dice**: ${cls.hd.number}d${cls.hd.faces}
**Hit Points at 1st Level**: ${cls.hd.faces} + your Constitution modifier
**Hit Points at Higher Levels**: ${cls.hd.number}d${cls.hd.faces} (or ${cls.hd.faces / 2 + 1}) + your Consititution modifier per ${cls.name} level after 1st`)
        .addField('Proficiencies',
                  Format.class.proficiencies(Object.assign({}, cls.startingProficiencies, { saving_throws: cls.proficiency })))
        .addField('Starting Equipment', Format.class.startingEquipment(cls.startingEquipment))
        .addField('Multiclassing', Format.class.multiclassing(cls.multiclassing))
    }

    // get class *feature* information
    query = query.join(' ').toLowerCase()
    const feature = Format.class.classFeatureByName(cls)
          .find(f => f.name.toLowerCase() === query)
    if (!feature) return 'error: could not find class feature'

    return embedEntries(embed.setTitle(`${cls.name} — ${feature.name}`)
                        .setFooter(`${feature.source || 'PHB'}`, ICON), feature.entries)
  }
}

module.exports.name = '5e-tools'
module.exports.commands = [
  {
    name: '5e',
    usage: '5e TOPIC QUERY',
    description: `lookup documentation for D&D 5th Edition

TOPIC must be one of the following:
- action,
- spell,
- feat,
- item,
- or levels.`,
    // If TOPIC is \`class\`, QUERY should be \`CLASS FEATURE-NAME\`
    min_args: 1,
    cooldown: 3,
    dms: true,
    run: async (msg, [topic, ...query]) => {
      if (!Section[topic])
        return msg.channel.send('error: topic not avaliable')
      const result = await Section[topic](query)
      return msg.channel.send(result instanceof Discord.MessageEmbed ? {embeds: [result]} : result)
    }
  },
]
