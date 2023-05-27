const Discord = require('discord.js')
const { clean } = require('../lib/util')
const { parseChannel, printChannel } = require('../lib/options')

module.exports.name = 'configs'
module.exports.commands = [
  {
    name: 'config',
    usage: 'config ( OPTION VALUE )?',
    description: `show or adjust guild settings

With no arguments, \`config\` displays all configuration options, \
and what they are currently set to.

When OPTION and VALUE is provided, it will attempt to set OPTION to \
VALUE.`,
    cooldown: 2,
    permission_level: 'MANAGE_GUILD',
    run: async (msg, [key, ...value]) => {
      const default_configs = msg.client.data.configs
      await Promise.all(Object.values(default_configs).map(
        c => msg.client.data.guilds.ensure(msg.guild.id, c.init || '', c.name)))

      if (value.length > 0) {
        if (!default_configs[key])
          return msg.channel.send(`error: \`${clean(key)}\` is not a valid option`)
        try {
          const parse = default_configs[key].parse || (v => clean(v.join()))
          await msg.client.data.guilds.set(msg.guild.id, await parse(value), key)
          var set_success = `*successfully set \`${key}\`*`
        } catch(e) {
          return msg.channel.send(`error: invalid value for \`${key}\``)
        }
      }

      // some keys in guilds are not options
      const current = await msg.client.data.guilds.get(msg.guild.id)
      return msg.channel.send({
        content: set_success,
        embeds:[
          new Discord.MessageEmbed()
            .setAuthor('configuration options', msg.client.user.avatarURL())
            .setColor('NOT_QUITE_BLACK')
            .setDescription(
              Object.keys(default_configs).map(
                k => `${k}: ${default_configs[k].print ? default_configs[k].print(current[k]) : '`'+current[k].toString()+'`'}`))
            .addField('note', 'To change an option, do `config OPTION NEWVALUE`, \
where OPTION is the name of the option, and NEWVALUE is the new value for OPTION.')
            .setFooter(msg.author.username, msg.author.avatarURL())
            .setTimestamp()]})
    }
  }
]

// basic config options and defaults
module.exports.configs = [
  {
    name: 'log-channel',
    init: '',
    parse: parseChannel,
    print: printChannel
  }
]
