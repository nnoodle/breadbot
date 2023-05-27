const Discord = require('discord.js')
const fetch = require('node-fetch')
const mathjs = require('mathjs')

const { wait, clean } = require('../lib/util')

const math = mathjs.create(mathjs.all)
const mathjsEval = math.evaluate

// D&D 5e money
math.createUnit('cp', { baseName: 'pieces' }, { override: true })  // override cups unit
math.createUnit('sp', '10 cp')
math.createUnit('ep', '5 sp')
math.createUnit('gp', '2 ep')
math.createUnit('pp', '10 gp')

math.import({
  'import':     function () { throw new Error('Function import is disabled') },
  'createUnit': function () { throw new Error('Function createUnit is disabled') },
  'evaluate':   function () { throw new Error('Function evaluate is disabled') },
  'parse':      function () { throw new Error('Function parse is disabled') },
  'simplify':   function () { throw new Error('Function simplify is disabled') },
  'derivative': function () { throw new Error('Function derivative is disabled') }
}, { override: true })

function formatInput(str) {
  const subst = {
    '×':'*',
    '`':'',
  }

  return str.trim()
    .replace(/[×`]/g, c => subst[c])
}

module.exports.name = 'math'
module.exports.commands = [
  {
    name: 'calc',
    aliases: ['c', 'calculator', 'math'],
    usage: 'calc EXPRESSION',
    description: 'calculate math expression',
    min_args: 1,
    dms: true,
    cooldown: 3,
    run: async (msg, _, user_expr) => {
      const embed = new Discord.MessageEmbed()
            .setTimestamp()
            .setColor('LIGHT_GREY')
            .setAuthor(msg.author.username, msg.author.avatarURL())
      try {
        const before = Date.now()
        var output = mathjsEval(formatInput(user_expr))
        const timed = Date.now() - before
        if (timed > 10)
          embed.setFooter(`${timed}ms`)
      } catch(e) {
        output = e.name+': '+e.message
      }
      return msg.channel.send({embeds:[embed.setDescription('```js\n'+clean(output)+'\n```')]})
    }
  }
]
