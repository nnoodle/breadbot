const Discord = require('discord.js')
const log = require('../lib/logger')
const env = require('../env')
const { clean, store } = require('../lib/util')

function formatSeconds(seconds) {
  const pad = s => (s < 10 ? '0' : '') + s
  let hours = Math.floor(seconds / (60*60))
  let minutes = Math.floor(seconds % (60*60) / 60)
  seconds = Math.floor(seconds % 60)

  return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds)
}

function extractLink(link) {
  const re = /https?:\/\/discord(?:app)?.com\/channels\/(?<guild>.+)\/(?<channel>\d+)\/(?<message>\d+)/
  const matches = re.exec(link)
  if (!matches)
    return matches
  return matches.groups
}

module.exports.name = 'meta'
module.exports.events = [
  {
    trigger: 'messageCreate',
    event: async msg => {
      if (msg.author.bot
          || (msg.channel.type !== 'dm')
          || !env.ownerguild)
        return

      const guild = msg.client.guilds.cache.get(env.ownerguild)
      let chan = guild.channels.cache.find(c => c.name === 'bread-talk')
      if (!chan) return

      let hook = (await chan.fetchWebhooks()).find(w => w.name === 'bread-dms')
      if (!hook)
        hook = await chan.createWebhook('bread-dms', {
          avatar: msg.author.avatarURL(),
          reason: 'create bread DMs webhook'
        })
      return hook.send({
        content: msg.content,
        username: msg.author.username,
        avatarURL: msg.author.avatarURL()
      })
    }
  }
]
module.exports.commands = [
  {
    name: 'ping', // required
    usage: 'ping', // optional
    description: '🏓', // defaults to '...'
    min_args: 0, // optional
    dms: true, // optional
    // permission_level: 'SEND_MESSAGES', // optional
    owner_only: false, // optional
    secret: false, // optional
    cooldown: 0, // defaults to 0
    // aliases: [], // optional
    run: async msg => { // required
      const embed = new Discord.MessageEmbed()
            .setTimestamp()
            .setColor('RANDOM')
            .setFooter('🏓 ' + msg.author.username)
            .setDescription('pinging…')
      return msg.channel.send({embeds: [embed]})
        .then(msg => msg.edit({embeds: [embed.setDescription(`pong! ${Date.now() - msg.createdTimestamp}ms.`)]}))
    }
  },
  {
    name: 'uptime',
    description: 'prints bot uptime.',
    dms: true,
    run: msg => msg.channel.send(`🍞 uptime: \`${formatSeconds(process.uptime())}\``)
  },
  {
    name: 'reload-module',
    usage: 'reload-module MODULE-NAMES*',
    aliases: ['reload'],
    owner_only: true,
    dms: true,
    min_args: 1,
    run: async (msg, modules) => {
      try {
        for (const mod of modules)
          msg.client.data.reloadModule(mod)
        log('reloaded modules:', modules.join(', '))
      } catch(e) {
        log.error(e)
      }
    }
  },
  {
    name: 'cache-message',
    usage: 'cache-message LINK*',
    owner_only: true,
    dms: true,
    min_args: 1,
    run: async (msg, links) => {
      for (const link of links) {
        const parsed = extractLink(link)
        if (parsed)
          try {
            const channel = msg.client.channels.cache.get(parsed.channel)
            const fetch = await channel.messages.fetch(parsed.message)
            await Promise.all(fetch.reactions.map(v => v.fetchUsers()))
            return msg.react('👍')
          } catch(e) {
            if (e.message === 'Unknown Message')
              return msg.channel.send(`error: could not find \`${link}\``)
            throw e
          }
      }
    }
  },
  {
    name: 'delete-msg',
    usage: 'delete-msg LINK*',
    owner_only: true,
    dms: true,
    min_args: 1,
    run: async (msg, links) => {
      for (const link of links) {
        const parsed = extractLink(link)
        if (parsed)
          try {
            const channel = msg.client.channels.cache.get(parsed.channel)
            const fetched = await channel.messages.fetch(parsed.message)
            if (fetched.author.id === msg.client.user.id)
              await fetched.delete()
            else
              return msg.channel.send(`\`${link}\`not made by me`)
          } catch(e) {
            if (e.message === 'Unknown Message')
              return (await msg.channel.send(`error: could not find \`${link}\``))
              .delete({ timeout: 5000 })
            throw e
          }
      }
    }
  },
  {
    name: 'eval',
    usage: 'eval JAVASCRIPT',
    aliases: ['EVAL', 'eval-async', 'EVAL-async'],
    owner_only: true,
    dms: true,
    run: async (msg, _, code, name) => {
      const EVAL_TIME = Date.now()
      try {
        /* eslint no-unused-vars: "off" */
        const client = msg.client
        const print = e => msg.channel.send(e.toString())
        const getmsg = link => {
          const id = extractLink(link)
          return client.channels.cache.get(id.channel).messages.fetch(id.message)
        }

        if (name.endsWith('async'))
          var result = clean(require('util').inspect(await eval(`(async () => {${code}})()`)))
        else
          result = clean(require('util').inspect(await eval(code)))

        if (!name.startsWith('EVAL')) {
          return msg.channel.send(
            {embeds: [
              new Discord.MessageEmbed()
                .setColor('GOLD')
                .addField('time', `${Date.now() - EVAL_TIME}ms`, true)
                .addField('chars', result.length.toString(), true)
                .setDescription('```js\n'+(result.length > 2030 ? result.substring(0, 2030) + '…' : result) + '```')]})
        }
      } catch(err) {
        return msg.channel.send(
          {embeds:[
            new Discord.MessageEmbed()
              .setColor('RED')
              .addField('time', `${Date.now() - EVAL_TIME}ms`, true)
              .addField('chars', 'null', true)
              .setDescription('```js\n'+clean(err)+ '```')]})
      }
    }
  },
]
