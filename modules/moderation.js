const Discord = require('discord.js')
const { getChannel } = require('../lib/options')
const { rgb2hsv, isName, wait } = require('../lib/util')

function sorthex(a, b) {
  const extract = str => [
    parseInt(str.substring(1,3), 16),
    parseInt(str.substring(3,5), 16),
    parseInt(str.substring(5,7), 16)
  ]
  a = rgb2hsv.apply(undefined, extract(a))
  b = rgb2hsv.apply(undefined, extract(b))
  if (a[0] !== b[0])
    return a[0] - b[0]
  else if (a[1] !== b[1])
    return a[1] - b[1]
  return a[2] - b[2]
}

function countImages(msg) {
  let images = 0
  if (msg.embeds.length) {
    const data = msg.embeds.filter(e => e.type === 'image' || e.type === 'gifv' || e.type === 'video')
    images += data.length
  }
  if (msg.attachments.size) {
    const img = msg.attachments.filter(d => /(?:a?png|jpe?g|gifv?|web[mp]|mp4|mov)$/.test(d.url.toLowerCase()))
    images += img.size
  }
  return images
}

let ReactLogs = new Map()
let ImageCooldown = new Map()

module.exports.name = 'moderation'
module.exports.events = [
  { // mute users that ping 23 or more people
    trigger: 'messageCreate',
    event: async msg => {
      if (msg.author.bot
          || !msg.member
          || !msg.guild.me.permissions.has('MANAGE_ROLES')
          || msg.member.permissions.has('MANAGE_MESSAGES')
         )
        return
      let matches = msg.content.match(/<@[&!]?\d+>/g)
      if (!matches) return
      matches = Array.from(new Set(matches.map(s => s.substring(s[2] === '!' ? 3 : 2, s.length-1))))
      const rolementions = matches.filter(r => r[0] === '&').length
      const score = rolementions * 11 + (matches.length - rolementions)

      if (score >= 23) {
        msg.member.roles.add(msg.guild.roles.cache.find(isName('Muted')),'mass mention')
        msg.channel.send('bang!')
      }
    }
  },
  { // remove the 3rd message within a period of 5 seconds onward with an image in general
    trigger: 'messageCreate',
    event: async msg => {
      if (msg.author.bot
          || !msg.channel
          || msg.channel.id !== '<#CHANNEL-ID>'
          || !msg.guild.me.permissions.has('MANAGE_MESSAGES')
         )
        return
      const imgcount = countImages(msg)
      if (!imgcount) return

      const id = msg.author.id
      const cd = ImageCooldown.get(id)

      if (!cd || new Date() - cd.last >= 3000)
        return ImageCooldown.set(id, { last: new Date(), count: imgcount})
      if (cd.count+imgcount < 3)
        return ImageCooldown.set(id, { last: new Date(), count: cd.count+imgcount})

      await msg.delete({ reason: '3rd+ consecutive message with image posted within 5 seconds' })
      return ImageCooldown.set(id, Object.assign({}, cd, { last: new Date() }))
    }
  },
  { // log leaves
    trigger: 'guildMemberRemove',
    event: async member => {
      if (member.roles.cache.size > 1) {
        const logs = await getChannel(member.guild, 'log-channel', ['logs-channel'])
        if (logs) {
          const role_list = member.roles.cache
                .sort((a, b) => b.position - a.position)
                .map(r => r.toString())
                .slice(0, -1).join('\n')
          return logs
            .send({embeds:[new Discord.MessageEmbed()
                           .setAuthor(member.user.tag, member.user.avatarURL())
                           .setThumbnail(member.user.avatarURL())
                           .setTitle('Member Left')
                           .setDescription(`${member} ${member.user.tag}`)
                           .setFooter(`ID: ${member.id}`)
                           .addField('Roles', role_list.length > 1024 ? '(too many to list)' : role_list.toString(), true)
                           .setColor('RED')
                           .setTimestamp()]})
        }
      }
    }
  },
  { // log reactions that have been quickly added and removed
    trigger: 'messageReactionAdd',
    event: async (react, user) => {
      // don't care about old reactions/messages
      if (react.partial ||
          react.message.partial ||
          !react.message.guild ||
          user.bot ||
          react.message.author.bot)
        return

      await wait(5000)
      try {
        await react.users.fetch()
      } catch(e) {
        if (e instanceof Discord.DiscordAPIError && e.message === 'Missing Access')
          return
        throw e
      }
      if (react.users.cache.has(user.id)) return

      const guildid = react.message.guild.id

      if (ReactLogs.has(guildid)) {
        let results = ReactLogs.get(guildid)
        results.push({ react, user, ts: Date.now() })
        ReactLogs.set(guildid, results)
      } else {
        ReactLogs.set(guildid, [{
          react, user,
          ts: Date.now(),
        }])

        await wait(25*1000) // wait 30-5 seconds
        const results = ReactLogs.get(guildid)
        ReactLogs.delete(guildid)

        const logs = await getChannel(react.message.guild, 'log-channel', ['logs-channel'])
        if (!logs) return

        const formatReactEntry = e => {
          let emoji
          if (e.react.emoji.url)
            emoji = `[\`:${e.react.emoji.name}:\`](${e.react.emoji.url})`
          else
            emoji = e.react.emoji.name
          return `${e.user} ${emoji} [\`[MESSAGE]\`](${e.react.message.url})`
        }

        return logs.send(
          {embeds:[
          new Discord.MessageEmbed()
            .setTitle('Flashed Reactions')
            .addFields(Discord.Util
                       .splitMessage(results.map(formatReactEntry).join('\n'), { maxLength: 1024 })
                       .map(value => ({ name: '\u200b', value })))
            .setFooter('(reacts added & removed within 5 seconds from the past 30 seconds)')
            .setColor('PURPLE')
            .setTimestamp()]})
      }
    }
  }
]

module.exports.commands = [
  {
    name: 'sort-color-roles',
    description: `sorts roles by color

Make sure all the roles you wish to sort are between two roles named \
\`!_BEGIN_!\` and \`!_END_!\`, where \`!_BEGIN_!\` is the role \
**closer to @\u200beveryone**, and \`!_END_!\` is the role *further*.
`,
    permission_level: 'MANAGE_ROLES',
    cooldown: 20,
    run: async msg => {
      let begin, end
      if (!(begin = msg.guild.roles.cache.find(isName('!_BEGIN_!'))))
        return msg.channel.send('error: no `!_BEGIN_!` role found')
      if (!(end = msg.guild.roles.cache.find(isName('!_END_!'))))
        return msg.channel.send('error: no `!_END_!` role found')

      let roles = msg.guild.roles.cache
          .filter(r => begin.position < r.position && r.position < end.position)
          .sort((a,b) => b.position - a.position)

      const roles_list = roles.size > 5
            ? '**__Last 5:__**\n`!_END_!`\n' + roles.first(5).join('\n')
            + '\n\n**__First 5:__**\n' + roles.last(5).join('\n') + '\n`!_BEGIN_!`'
            : '`!_END_!`\n'+roles.array().join('\n')+'\n`!_BEGIN_!`'

      await msg.channel.send({
        embeds: [
          new Discord.MessageEmbed()
            .setTitle('ACHTUNG!')
            .setColor('ORANGE')
            .setTimestamp()
            .addField('Note', '*`!_BEGIN_!` should be the role **closer** to the “@everyone” role.*')
            .setDescription(`This will sort **${roles.size}** roles. Proceed? *(Type "y" or "yes" to proceed)*\n${roles_list}`)
        ]
      })

      var coll = await msg.channel.awaitMessages(m => msg.author.id === m.author.id, { max: 1, time: 15000 })
      if (coll.size === 0)
        return msg.channel.send('timeout reached, aborting sort operation')

      const r = coll.last().content
      if (!(r === 'y' || r === 'yes'))
        return msg.channel.send('cancelling sort operation')

      const status = await msg.channel.send('sorting…')
      roles = roles.sort((a,b) => sorthex(a.hexColor, b.hexColor))
      for (let [_id, role] of roles)
        await role.setPosition(begin.position+1)
      return status.edit('done!')
    }
  },
]
