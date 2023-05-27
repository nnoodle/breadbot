const Discord = require('discord.js')
const { Mutex, withTimeout } = require('async-mutex')
const Opts = require('../lib/options')
const { fetchPartial, randomElem } = require('../lib/util')
const log = require('../lib/logger')
const { pinFormatEmbed } = require('./pin')

const SQUARE = '🟧'
const Mutexes = {}

function _squareGradientColor(count) {
  // whatever the heck R. Danny uses
  let p = count / 13
  if (p > 1.0)
    p = 1.0
  const r = 255
  const g = Math.round((194 * p) + (253 * (1 - p)))
  const b = Math.round((12 * p) + (247 * (1 - p)))
  return [r, g-12, b-12]
}

async function squareMessage(react, user) {
  try {
    await fetchPartial([react, react.message])
  } catch(e) {
    if (e.message !== 'Missing Access')
      log.error(e)
    return
  }
  const msg = react.message

  if (!msg.guild ||
      react.emoji.name !== SQUARE ||
      msg.author.id === user.id ||
      msg.channel.nsfw)
    return

  const squares_reacts = msg.reactions.cache.get(SQUARE)
  // await squares_reacts?.users.fetch()
  let count = squares_reacts ? Math.max(squares_reacts.users.cache.size,squares_reacts.count) : 0
  const db = msg.client.data.guilds
  await db.ensure(msg.guild.id, {}, 'squares')
  const threshold = await Opts.get(msg.guild, 'square-threshold')
  const squareboard = await Opts.getChannel(msg.guild, 'squareboard', ['squareboard', 'starboard'])
  const pinboard = await Opts.getChannel(msg.guild, 'pinboard', ['pinboard', 'starboard'])

  if (threshold === 0 ||
      !squareboard ||
      msg.channel.id === squareboard.id ||
      (pinboard && pinboard.id === msg.channel.id && msg.author.bot))
    return
  if (count > 0 && squares_reacts.users.cache.get(msg.author.id))
    count--

  if (!Mutexes[msg.guild.id])
    Mutexes[msg.guild.id] = withTimeout(new Mutex(), 2500, new Error('squareboard timeout reached'))

  try {
    await Mutexes[msg.guild.id].acquire()
    await (async function() {
      const boardmsg = await db.has(msg.guild.id, `squares.${msg.id}`)
            ? await squareboard.messages.fetch(await db.get(msg.guild.id, `squares.${msg.id}`))
            : undefined

      if (!boardmsg && count < threshold) return
      if (boardmsg && count < threshold) {
        await db.delete(msg.guild.id, `squares.${msg.id}`)
        boardmsg.delete()
        return
      }

      const body = `${SQUARE} **${count > 99 ? '99+' : count}** ${msg.channel} ID: ${msg.id}`
      const square_message = (await pinFormatEmbed(msg))
            .setColor('ORANGE')
            .setFooter(squareReaction(msg.id, msg.author.id))
      if (!boardmsg && count >= threshold) {
        const bm = await squareboard.send({content: body, embeds: [square_message]})
        await db.set(msg.guild.id, bm.id, `squares.${msg.id}`)
        return
      }
      if (boardmsg && count >= threshold) {
        boardmsg.edit({content: body, embeds: [square_message]})
        return
      }
    })()
  } catch(e) {
    log.error('error squaring message', e)
    Mutexes[msg.guild.id].release()
    if (Mutexes[msg.guild.id].isLocked()) {
      // die dumb mutex!!!
      Mutexes[msg.guild.id] = withTimeout(new Mutex(), 2500, new Error('squareboard timeout reached'))
      log.warn('replaced mutex')
    }
  } finally {
    Mutexes[msg.guild.id].release()
  }
}

function squareReaction(msgid, user) {
  let reacts = [
    '🗿',
    'for what purpose',
    'haram',
    'please stop',
    'this is illegal',
    'why',
    'why are you like this',
    'cease and desist',
  ]
  return reacts[Discord.SnowflakeUtil.deconstruct(msgid).timestamp % reacts.length]
}


module.exports.name = 'squareboard'
module.exports.configs = [
  {
    name: 'squareboard',
    init: '',
    parse: Opts.parseChannel,
    print: Opts.printChannel
  },
  {
    name: 'square-threshold',
    init: 3,
    parse: Opts.parseInteger(0, 100),
    print: num => {
      switch(num) {
      case 0: return '0 *(disabled)*'
      case 100: return '100 *(max)*'
      default: return num.toString()
      }
    }
  }
]
module.exports.commands = [
  {
    name: 'square-random',
    description: 'get a random square from the squareboard',
    run: async msg => {
      const db = msg.client.data.guilds
      const squares = db.get(msg.guild.id, 'squares')
      const square_id = squares[randomElem(Object.keys(squares))]

      const squareboard = await Opts.getChannel(msg.guild, 'squareboard', ['squareboard', 'starboard'])
      try {
        var square = await squareboard.messages.fetch(square_id)
      } catch(e) {
        if (e.message == 'Unknown Message')
          return msg.channel.send(`<deleted square id: ${square_id}>`)
        else
          throw e
      }

      return msg.channel.send({
        content: square.content,
        embeds: square.embeds
      })
    }
  }
]
module.exports.events = [
  { event: squareMessage, trigger: 'messageReactionAdd' },
  { event: squareMessage, trigger: 'messageReactionRemove' }
]
