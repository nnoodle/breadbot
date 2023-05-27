const Discord = require('discord.js')
const DiceRoll = require('../lib/roll')
const log = require('../lib/logger')
const hexagrams = Object.values(require('../lib/iching-hexagrams'))
const { clean, randomElem } = require('../lib/util')

/*
for (k in iching) {
  let v = iching[k]
  v.binary = v.binary.toString()
  v.above = trigrams[v.binary.substring(0, 3)]
  v.below = trigrams[v.binary.substring(3, 6)]

  v.judgement = v.wilhelm_judgment.text
  v.image = v.wilhelm_image.text

  delete v.wilhelm_above
  delete v.wilhelm_below
  delete v.wilhelm_symbolic
  delete v.wilhelm_judgment
  delete v.wilhelm_image
  delete v.wilhelm_lines
}
*/

const BREAD = '🍞'
const TAROT_CARDS = [
  { name: 'The Fool', value: 0 },
  { name: 'The Magician', value: 1 },
  { name: 'The High Priestess', value: 2 },
  { name: 'The Empress', value: 3 },
  { name: 'The Emperor', value: 4 },
  { name: 'The Hierophant', value: 5 },
  { name: 'The Lovers', value: 6 },
  { name: 'The Chariot', value: 7 },
  { name: 'Strength', value: 8 },
  { name: 'The Hermit', value: 9 },
  { name: 'Wheel of Fortune', value: 10 },
  { name: 'Justice', value: 11 },
  { name: 'The Hanged Man', value: 12 },
  { name: 'Death', value: 13 },
  { name: 'Temperance', value: 14 },
  { name: 'The Devil', value: 15 },
  { name: 'The Tower', value: 16 },
  { name: 'The Star', value: 17 },
  { name: 'The Moon', value: 18 },
  { name: 'The Sun', value: 19 },
  { name: 'Judgement', value: 20 },
  { name: 'The World', value: 21 }
]
const PLAYING_CARDS = Array.from('🂡🂢🂣🂤🂥🂦🂧🂨🂩🂪🂫🂭🂮🂱🂲🂳🂴🂵🂶🂷🂸🂹🂺🂻🂽🂾🃁🃂🃃🃄🃅🃆🃇🃈🃉🃊🃋🃍🃎🃑🃒🃓🃔🃕🃖🃗🃘🃙🃚🃛🃝🃞')


function iching() {
  const YIN = 0, YANG = 1
  const flip = () => Math.floor(Math.random()*2)+2
  const gram = () => flip()+flip()+flip()
  const hexagram = [gram(), gram(), gram(), gram(), gram(), gram()]
        .map(g => {
          switch (g) {
          case 6: return [YIN, YANG]
          case 7: return [YIN, YIN]
          case 8: return [YANG, YANG]
          case 9: return [YANG, YIN]
          }
        }).reduce((col, [ol, ne]) => [col[0]+ol.toString(), col[1]+ne.toString()], ['',''])
  if (hexagram[0] === hexagram[1])
    return hexagrams.find(h => h.binary === hexagram[1])
  else
    return [hexagrams.find(h => h.binary === hexagram[0]),hexagrams.find(h => h.binary === hexagram[1])]
}

function drawCards(deck, amount = 1) {
  let res = []
  if (amount > 1)
    [res, deck] = drawCards(deck, amount-1)
  const index = Math.floor(Math.random() * deck.length)
  return [[deck[index]].concat(res), deck.filter((_, i) => i !== index)]
}

module.exports.name = 'dice'
module.exports.commands = [
  {
    name: 'roll',
    usage: 'roll NdR + C',
    description: `roll dice

\`roll\` rolls dice denoted in standard dice notation:
- N is the number of dice to be rolled (usually omitted if 1)
- R is the number of faces on each die
- C is a natural number, if a constant modifier is necessary

Dice options include:
- kN is used to drop all but the highest N in the dice roll (e.g. 4d6k3)
- pN is used to drop all but the lowest N in the dice roll (e.g. 2d20p1)

Dice rolls can be grouped and separated with ";"

Everything after the "!" character is ignored, treated as a comment.

A rather complicated invocation might look something like:

    \`roll 2d20p1+11; 4d6k3; d4+5; 22/7*2 ! try me!\``,
    min_args: 1,
    aliases: ['r'],
    run: async (msg, _, args) => {
      const formatDiceRoll = r => `🎲 \`${r.orig}\` ⇒ \`${r.text}\` = \`${r.val}\``

      let results = DiceRoll(clean(args))
      let output = results.rolls.length === 1
          ? formatDiceRoll(results.rolls[0])
          : results.rolls.map(formatDiceRoll).join('\n')
      output += ` ${msg.author}`
      if (results.comment)
        output += `\n> ${results.comment}`
      return msg.channel.send(output).catch(log.error)
    }
  },
  {
    name: 'random',
    usage: 'random MESSAGE-ID EMOTE AMOUNT?',
    min_args: 1,
    description: `select a random winner in #giveaways

\`random\` will select a random user that reacted the message referenced by MESSAGE-ID with EMOTE.
When AMOUNT is provided, it'll select AMOUNT users.`,
    cooldown: 2,
    run: async (message, [msg_id, user_emote, user_amount]) => {
      if (message.channel.name !== 'giveaways') return
      try {
        var msg = await message.channel.messages.fetch(msg_id)
      } catch(e) {
        if (e.message === 'Unknown Message')
          return (await message.channel.send('error: could not find message')).delete({ timeout: 5000 })
        else throw e
      }
      const emote = user_emote || BREAD
      const amount = isNaN(user_amount) ? 1 : Math.abs(parseInt(user_amount))
      const users = await msg.reactions.cache.find(e => e.emoji.toString() === emote).users.fetch()
      return msg.channel.send(`🎉 — ${users.random(amount).filter(u => u).map(u => `<@${u.id}>`)}`)
    }
  },
  {
    name: 'tarot',
    description: 'draw a major arcana tarot card',
    cooldown: 1,
    run: async msg => {
      let card = randomElem(TAROT_CARDS)
      let embed = new Discord.MessageEmbed()
          .setAuthor(msg.author.username, msg.author.avatarURL())
          .setDescription('You have drawn, ' + card.name + '!')
          .setColor('PURPLE')
          .setImage('https://cdn.glitch.com/07645121-91b2-49e1-9954-87a72befe0dc%2Fogretarot'
                    +String(card.value).padStart(2,'0')+'.png')
          .setTimestamp()
      if (Math.floor(Math.random() * 20) + 1 < 10) // 45% chance it's upside down
        embed.setFooter('(upside down)')
      return msg.channel.send({embeds:[embed]})
    }
  },
  {
    name: 'iching',
    description: 'consult the *I Ching* oracle',
    cooldown: 1,
    run: async msg => {
      const f = iching()
      let embed = new Discord.MessageEmbed()
          .setTitle('I Ching')
          .setDescription(Array.isArray(f)
                          ? `**${f[0].english}**\n> ${f[0].hex_font} ⇝ ${f[1].hex_font}\n**${f[1].english}**`
                          : `> ${f.hex_font}\n**${f.english}**`)
      return msg.channel.send({embeds:[embed]})
    }
  },
  {
    name: 'poker',
    description: 'play a hand of five draw poker',
    cooldown: 5,
    run: async msg => {
      let [hand, deck] = drawCards(PLAYING_CARDS, 5)
      return msg.channel.send({
        embeds:[new Discord.MessageEmbed()
                .setAuthor(msg.author.tag, msg.author.avatarURL())
                .setColor('DARK_RED')
                .setTimestamp()
                .setDescription(hand.join(' '))
                .setFooter('First draw')
                .addField('Tossing', 'You can toss cards by typing “toss *CARD-INDEXES*” in the next 20 seconds.\nExample: “toss 125” tosses the first, second, and fifth card.', true)]})
        .then(_res =>
          msg.channel.awaitMessages(m => m.content.startsWith('toss ') && msg.author.id === m.author.id, { max: 1, time: 20000 }))
        .then(coll => {
          if (coll.size > 0) {
            let toss = coll.last().content.slice(5)
            if (toss.includes('1'))
              [[hand[0]], deck] = drawCards(deck)
            if (toss.includes('2'))
              [[hand[1]], deck] = drawCards(deck)
            if (toss.includes('3'))
              [[hand[2]], deck] = drawCards(deck)
            if (toss.includes('4'))
              [[hand[3]], deck] = drawCards(deck)
            if (toss.includes('5'))
              [[hand[4]], deck] = drawCards(deck)
          }
          msg.channel.send({
            embeds:[new Discord.MessageEmbed()
                    .setAuthor(msg.author.tag, msg.author.avatarURL())
                    .setColor('DARK_RED')
                    .setTimestamp()
                    .setDescription(hand.join(' '))
                    .setFooter('Final draw')]})
        })
    }
  }
]
