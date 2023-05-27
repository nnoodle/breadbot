const Discord = require('discord.js')
const util = require('util')
const timeout = util.promisify(setTimeout)

async function justAddRole(member, role) {
  try {
    await member.roles.add(role, 'returning roles from last leave')
  } catch(e) {
    if (e instanceof Discord.RateLimitError) {
      log.warn(`ratelimit hit whilst adding roles, timeout for ${e.timeout}ms`)
      await timeout(e.timeout)
      await justAddRole(member, role)
    } else if (!(e instanceof Discord.DiscordAPIError
          && (e.message === 'Unknown Role' || e.message === 'Missing Permissions')))
      log.warn(e)
  }
}

module.exports.name = 'role-leave-join-give'
module.exports.events = [
  {
    trigger: 'guildMemberRemove',
    event: async member => {
      if (member.user.bot) return

      const roles = member.roles.cache.map(r => r.id)
      if (roles.length > 1)
        return member.client.data.guilds.set(member.guild.id, roles, `roles.${member.id}`)
    }
  },
  {
    trigger: 'guildMemberAdd',
    event: async member => {
      if (!(await member.client.data.guilds.has(member.guild.id, `roles.${member.id}`)))
        return

      const roles = await member.client.data.guilds.get(member.guild.id, `roles.${member.id}`)
      if (member.guild.me.permissions.has('MANAGE_ROLES'))
        // return member.roles.add(roles, 'returned roles from last leave')
        for (const r of roles)
          await justAddRole(member, r)
    }
  }
]
