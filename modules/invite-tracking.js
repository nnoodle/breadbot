const Discord = require('discord.js')
const log = require('../lib/logger')
const { wait, getStore } = require('../lib/util')
const { getChannel } = require('../lib/options')

const guild_invites = getStore('guild-invites', new Map())
const guild_vanity_invites = getStore('guild-vanity-invites', {})

async function getVanityInvite(guild) {
  if (guild_vanity_invites[guild.id] !== null) {
    try {
      return (guild_vanity_invites[guild.id] = await guild.fetchVanityData())
    } catch(e) {
      return (guild_vanity_invites[guild.id] = null)
    }
  } else
    return null
}

module.exports.name = 'invite-tracking'
module.exports.init = async client => {
  await wait(1000)
  for (let guild of client.guilds.cache.values()) {
    if (guild.me.permissions.has('MANAGE_GUILD')) {
      const invites = await guild.invites.fetch()
      guild_invites.set(guild.id, invites)
      if (guild.vanityURLCode)
        await getVanityInvite(guild)
    }
  }
}

module.exports.events = [
  {
    trigger: 'guildMemberAdd',
    event: async member => {
      const guild = member.guild
      if (member.user.bot || !guild.me.permissions.has('MANAGE_GUILD'))
        return

      const after = await guild.invites.fetch()
      const before = guild_invites.get(guild.id)

      guild_invites.set(guild.id, after)
      if (!before) return
      let invite = after.find(ai => before.get(ai.code)?.uses < ai.uses)

      if (!invite) {
        // there is no difference between our old set of invites and
        // our new set of invites. that means the invite is fresh
        const diff = after.filter(ai => ai.uses > 0 && !(before.get(ai.code)))
        invite = diff.size !== 0 ? diff.entries().next().value[1] : invite
      }

      if (!invite && guild.vanityURLCode) {
        // possibly a vanity invite?
        const vbefore = guild_vanity_invites[guild.id]
        const vafter = await getVanityInvite(guild)
        if (vafter.uses > vbefore?.uses)
          invite = vafter
      }

      if (!invite)
        return log.warn(`warning: could not find invite for "${member.displayName}" (${member.id}@${guild.id})`)

      const logs = await getChannel(member.guild, 'log-channel', ['logs-channel'])
      if (logs)
        return logs
        .send({embeds:[
          new Discord.MessageEmbed()
            .setAuthor(member.user.tag, member.user.avatarURL())
            .setThumbnail(member.user.avatarURL())
            .setTitle('Member Joined')
            .setDescription(`${member} ${member.user.tag}`)
            .setFooter(`ID: ${member.id}`)
            .addField('Invite Code', invite.code.toString(), true)
            .addField('Invite Uses', invite.uses.toString(), true)
            .addField('Inviter', invite.inviter
                      // invite.inviter isn't guaranteed to exist
                      ? `${invite.inviter} ${invite.inviter.tag}`
                      : `${guild.owner} ${guild.owner?.user?.tag}`) // getting errors of this being null?
            .setColor('GREEN')
              .setTimestamp()]})
    }
  }
]
