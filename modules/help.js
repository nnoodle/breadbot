const Discord = require('discord.js')

module.exports.name = 'help'
module.exports.commands = [
  {
    name: 'help', // required
    usage: 'help COMMAND?', // optional
    description: `prints command documentation

When COMMAND is provided, this prints more detailed information about command.`, // defaults to '...'
    cooldown: 1, // defaults to 0
    aliases: ['man'], // optional
    run: async (msg, [name]) => {
      const { commands } = msg.client.data
      const documented_commands = Object.keys(commands)
            .filter(n => !commands[n].owner_only)
      const displayed_commands = Object.keys(commands)
            .filter(n => commands[n].name === n &&
                    !(commands[n].secret || commands[n].owner_only))

      let embed = new Discord.MessageEmbed()
          .setTitle('Bread Manual')
          .setColor('RED')
          .setFooter(msg.author.username, msg.author.avatarURL())
          .setTimestamp()

      if (name && documented_commands.find(c => c === name)) {
        const cmd = msg.client.data.commands[name]
        embed
          .addField('NAME', cmd.name + (cmd.aliases ? ` (aliases: ${cmd.aliases.join(', ')})` : ''))
          .addField('SYNOPSIS', cmd.usage || cmd.name)
          .addField('DESCRIPTION', cmd.description || '🦗')
        if (cmd.extra_fields)
          for (const field of cmd.extra_fields)
            embed.addField(field.name, field.value, field.inline)
      } else {
        embed.setDescription(
          displayed_commands.sort().reverse()
            .map(n => {
            const cmd = msg.client.data.commands[n]
            return `\`${cmd.name}\`: ${cmd.description && cmd.description.split('\n')[0] || '🦗'}`
          }).join('\n'))
      }
      return msg.channel.send({embeds: [embed]})
    }
  }
]
