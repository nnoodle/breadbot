const path = require('path')
const cowsay = require('cowsay')

module.exports.name = 'cowsay'
module.exports.commands = [
  {
    name: 'cowsay',
    aliases: ['cowthink'],
    usage: 'cowsay [-bdgpstwyrl] [-e EYES] [-T TONGUE] [-f COW] MESSAGE*',
    description: `generate a talking/thinking cow

To change the ASCII art to something else other than a cow, use \`-f \
COW\`, where COW is one of the options listed using the \`-l\` flag. \
To set a *random* cow instead, use the \`-r\` flag instead.

To change the eyes and tongue of the cow, use the \`-e EYES\` and \`-T TONGUE\` \
flags, for example:
\`cowsay -e θθ -T " U" i want fuit gummy\`

There are also several built-in "modes" that change the eyes/tongue of \
the cow, among them are:
\`-b\` (borg)
\`-d\` (dead)
\`-g\` (greedy)
\`-p\` (paranoia)
\`-s\` (stoned)
\`-t\` (tired)
\`-w\` (wired)
\`-y\` (youthful)`,
    min_args: 1,
    cooldown: 0.5,
    run: async (msg, args, _, sayorthink) => {
      const emote = sayorthink === 'cowsay' ? cowsay.say : cowsay.think
      const opts = {
        text: ''
      }
      let getlastopt = null
      for (let arg of args) {
        if (getlastopt) {
          opts[getlastopt] = arg
          getlastopt = null
        }
        else if (!opts.text && arg.startsWith('-')) {
          let opt = arg.slice(1,3)
          if ('bdgpstwyrl'.includes(opt))
            arg.slice(1)
              .split('')
              .forEach(o => 'bdgpstwyrl'.includes(o) && (opts[o] = true))
          else if ('eTf'.includes(opt))
            getlastopt = opt
          else
            opts.text += ' '+arg
        } else
          opts.text += ' '+arg
      }

      if (opts.l) {
        const lst = (await cowsay.list(x => x))
              .map(c => path.basename(c, '.cow'))
              .join(', ')
        return msg.channel.send('```\n'+lst+'```')
      }

      opts.text = (opts.text.length === 0)
        ? 'i want fuit gummy'
        : opts.text.trim()

      const output = emote(opts).replace(/`/g, '‘')
      if (output.length >= 2000-7)
        return msg.channel.send('sorry, that was too big for me...')
      return msg.channel.send('```\n'+output+'```')
    }
  },
]
