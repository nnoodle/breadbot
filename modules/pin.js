const Discord = require('discord.js')
const Opts = require('../lib/options')
const log = require('../lib/logger')
const { fetchPartial } = require('../lib/util')

const BREAD = '🍞'
const PIN = '📌'

/**
 * pinFormatEmbed
 * @param {Discord.Message} msg
 */
async function pinFormatEmbed(msg) {
  let embed = new Discord.MessageEmbed()
      .setAuthor(msg.author.username, msg.author.avatarURL())
      .setDescription(msg.content)
      .setColor('RED')
      .setTimestamp(msg.editedTimestamp || msg.createdTimestamp)

  if (msg.embeds.length) {
    const data = msg.embeds.find(e => e.type === 'image')
    if (data)
      embed.setImage(data.url)
  }
  if (msg.attachments.size) {
    const img = msg.attachments
          .find(d => /(?:png|jpeg|jpg|gif|webp)$/.test(d.url.toLowerCase()))
    if (img)
      embed.setImage(img.url)
    else {
      const file = msg.attachments.first()
      embed.addField('Attachment', `[${file.name}](${file.url})`)
    }
  }
  //if (msg.stickers.size)
  if (msg.reference && await msg.fetchReference()) {
    const reply = await msg.fetchReference()
    let content
    if (reply.content.length === 0) { // there must be an attachment
      content = `[*Click to see attachment*](${reply.url}) 🖼`
    } else {
      const limit = 512
      content = reply.content.length > limit ? reply.content.slice(limit) + '…' : reply.content
    }

    embed.addField('Reply To', `[@${reply.author.username}](${reply.url}) ${content}`)
  }

  embed.addField('Original', `[Jump!](https://discord.com/channels/${msg.guild.id}/${msg.channel.id}/${msg.id})`)
  return embed
}

async function pinMessage(msg, pinner) {
  const pinboard = await Opts.getChannel(msg.guild, 'pinboard', ['pinboard', 'starboard'])

  if (!pinboard)
    return msg.channel.send('error: pinboard not found')

  if (!msg.channel.nsfw &&
      !msg.reactions.cache.find(val => val.emoji.name === BREAD && val.me) &&
      msg.channel.id !== pinboard.id) {
    msg.react(BREAD).catch(log.curry('error', `pinMessage(${msg.id}, ${pinner.id})`))
    return pinboard.send({
      content: `${PIN} ${msg.channel} ID: ${msg.id}`,
      embeds: [(await pinFormatEmbed(msg))
               .setFooter(`pinned by ${pinner.username}`, pinner.avatarURL())]
    })
  }
}

module.exports.name = 'pinboard'
module.exports.configs = [
  {
    name: 'pinboard',
    init: '',
    parse: Opts.parseChannel,
    print: Opts.printChannel
  }
]
module.exports.events = [
  {
    trigger: 'messageReactionAdd',
    event: async (react, user) => {
      await fetchPartial([react, react.message])
      if (react.message.guild &&
          react.emoji.name === PIN &&
          react.message.guild.members.cache.get(user.id).permissions.has('MANAGE_MESSAGES'))
        return pinMessage(react.message, user)
    }
  }
]

module.exports.commands = [
  {
    name: 'pin',
    usage: 'pin MESSAGE-ID',
    description: 'pin a message found in this channel',
    permission_level: 'MANAGE_MESSAGES',
    min_args: 1,
    run: async (msg, [msgid]) => {
      if (!Number(msgid))
        return msg.channel.send('error: not a message ID.')
      return msg.channel.messages.fetch(msgid)
        .then(m => pinMessage(m, msg.author))
        .catch(err => {
          if (err.message === 'Unknown Message')
            return msg.channel.send('error: could not find message')
          else
            throw err
        })
    }
  }
]

// lib
module.exports.pinFormatEmbed = pinFormatEmbed
