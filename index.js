const env = Object.assign({ ownerid: '_', datadir:'data/' }, require('./env'))

const Discord = require('discord.js')
const Enmap = require('enmap')
const fs = require('fs').promises
const log = require('./lib/logger')
const { randomElem } = require('./lib/util')

const MODULES_DIR = './modules'
const PERMISSIONS = [
  'MANAGE_GUILD', // invite tracking
  'ADD_REACTIONS',
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'MANAGE_MESSAGES',
  'EMBED_LINKS',
  'ATTACH_FILES',
  'READ_MESSAGE_HISTORY',
  'USE_EXTERNAL_EMOJIS',
  'CONNECT',
  'SPEAK',
  'CHANGE_NICKNAME',
  'MANAGE_ROLES',
  'MANAGE_WEBHOOKS',
]

// initialize bot
const client = new Discord.Client({
  messageCacheMaxSize: 300,
  restTimeOffset: 1000,
  intents: [
    'GUILDS',
    'GUILD_MEMBERS',
    'GUILD_BANS',
    'GUILD_EMOJIS_AND_STICKERS',
    'GUILD_INTEGRATIONS',
    'GUILD_WEBHOOKS',
    'GUILD_INVITES',
    // 'GUILD_VOICE_STATES',
    // 'GUILD_PRESENCES',
    'GUILD_MESSAGES',
    'GUILD_MESSAGE_REACTIONS',
    'DIRECT_MESSAGES',
    'DIRECT_MESSAGE_REACTIONS'
  ],
  disabledEvents: ['TYPING_START'],
  partials: ['MESSAGE', 'REACTION'],
})


client.data = {
  guilds: new Enmap({
    name: 'guilds',
    dataDir: env.datadir
  }),
  cooldowns: {},
  /*
   * type Command = {
   *   name: string,
   *   usage?: string,
   *   description?: string,
   *   extra_fields?: {'name': string, 'value': string, 'inline': boolean}[],
   *   min_args?: number,
   *   dms?: boolean,
   *   permission_level?: Discord.PermissionResolvable,
   *   owner_only?: boolean
   *   secret?: boolean,
   *   cooldown?: number,
   *   aliases?: string[],
   *   run (message: Message, args: string[]): function
   * }
   */
  commands: {},
  /*
   * type Config = {
   *   name: string,
   *   init?: any,
   *   parse? (input: string[]): async function -> Error OR any
   *   print? (value: any): function -> string
   * }
   */
  configs: {
    'prefix': { name: 'prefix', init: ';' }
  },
}

function loadModule(name, doinit=false) {
  const module = require(`${MODULES_DIR}/${name}`)

  if (module.init && doinit)
    module.init(client)

  if (module.jobs) {
    for (const job of module.jobs) {
      job.interval = client.setInterval(() => job.job(client), job.period*1000)
      if (job.run_now)
        job.job(client).catch(log.error)
    }
  }

  if (module.commands) {
    for (const cmd of module.commands) {
      const names = cmd.aliases ? cmd.aliases.concat([cmd.name]) : [cmd.name]
      names.forEach(n => client.data.commands[n] = cmd)
    }
  }

  if (module.configs) {
    for (const conf of module.configs)
      client.data.configs[conf.name] = conf
  }

  if (module.events) {
    for (const event of module.events) {
      const fn = event.event
      event.event = async (...args) => {
        try {
          return await fn(...args)
        } catch(e) {
          return log.error(`in ${name}.events.${event.trigger}:`, e)
        }
      }
      client.on(event.trigger, event.event)
    }
  }
}

function unloadModule(name) {
  const module = require(`${MODULES_DIR}/${name}`)

  if (module.jobs) {
    for (const job of module.jobs)
      client.clearInterval(job.interval)
  }

  if (module.commands) {
    for (const cmd of module.commands) {
      const names = cmd.aliases ? cmd.aliases.concat([cmd.name]) : [cmd.name]
      names.forEach(n => delete client.data.commands[n])
    }
  }

  if (module.configs) {
    for (const conf of module.configs)
      delete client.data.configs[conf.name]
  }

  if (module.events) {
    for (const event of module.events)
      client.off(event.trigger, event.event)
  }

  delete require.cache[require.resolve(`${MODULES_DIR}/${name}`)];
}

function reloadModule(name, doinit=false) {
  unloadModule(name)
  loadModule(name, doinit)
}
Object.assign(client.data, { loadModule, unloadModule, reloadModule })

async function initializeModules() {
  const files = await fs.readdir('./modules')
  for (const file of files) {
    // files starting with '-' are 'disabled'
    if (!file.startsWith('-')) {
      const name = file.split('.')[0]
      loadModule(name, true)
    }
  }
}

function parseArgs(args) {
  // taken from https://github.com/nixnest/scepter (MIT)
  if (!args) return []
  return args.match(/\\?.|^$/g).reduce((p, c) => {
    if (c === '"')
      p['quote'] ^= 1
    else if (!p['quote'] && c === ' ')
      p.a.push('')
    else
      p.a[p.a.length - 1] += c.replace(/\\(.)/, '$1')
    return p
  }, { a: [''] }).a
}

async function runCommand(msg, cmd, args, literal, cmdname) {
  if (msg.author.id !== env.ownerid) {
    if (cmd.owner_only) return
    if (!msg.member && !cmd.dms)
      return (await msg.channel.send('error: this command can only be ran in a guild.'))

    if (typeof cmd.cooldown === 'number') {
      if (!client.data.cooldowns[msg.author.id])
        client.data.cooldowns[msg.author.id] = {}
      if (!client.data.cooldowns[msg.author.id][cmd.name])
        client.data.cooldowns[msg.author.id][cmd.name] = new Date(0)
      const expiry = new Date(client.data.cooldowns[msg.author.id][cmd.name])
      if (expiry.getTime() > msg.createdTimestamp)
        return msg.channel.send(
          `error: this command has a cooldown of \`${cmd.cooldown}\` seconds`
            + `(\`${new Date(expiry - Date.now()).getSeconds()+1}\` left)`)
      client.data.cooldowns[msg.author.id][cmd.name] =
        new Date(msg.createdTimestamp + cmd.cooldown * 1000)
    }

    if (cmd.min_args && args.length < cmd.min_args)
      return msg.channel.send(
        `error: insufficient arguments for \`${cmd.name}\` (min: ${cmd.min_args}). try \`help ${cmd.name}\` for command usage`)

    if (cmd.permission_level && !msg.member.permissions.has(cmd.permission_level))
      return msg.channel.send(`error: permission denied for \`${cmd.name}\`.`)
  }
  try {
    await cmd.run(msg, args, literal, cmdname)
  } catch(e) {
    msg.channel.send('error: something went wrong!')
    log.error(`command call: \`${cmd.name}${args.length ? ' '+args.join(' ') : ''}\``, e)
  }
}

client.on('guildCreate', guild => client.data.guilds.ensure(guild.id, {}))
client.on('guildDelete', guild => client.data.guilds.delete(guild.id))

client.on('messageCreate', async msg => {
  if (msg.guild) {
    await client.data.guilds.ensure(msg.guild.id, ';', 'prefix')
    var nprefix = await client.data.guilds.get(msg.guild.id, 'prefix')
  } else nprefix = ';'

  let prefix
  if (msg.content.startsWith(nprefix))
    prefix = nprefix

  if (msg.content.startsWith(`<@${client.user.id}> `))
    prefix = `<@${client.user.id}> `
  if (msg.content.startsWith(`<@!${client.user.id}> `))
    prefix = `<@!${client.user.id}> `

  if (prefix && !msg.author.bot) {
    const name = msg.content.substring(prefix.length).split(' ')[0]
    if (client.data.commands[name]) {
      const args = msg.content.substring(prefix.length + name.length + 1)
      runCommand(msg, client.data.commands[name], parseArgs(args), args, name)
    }
  }
})

client.on('ready', async () => {
  const BREAD = '🍞'
  const PRESENCE = [
    'Teleporting Bread'
    , '100% Whole Wheat Bread!'
    , `${BREAD}${BREAD}${BREAD}${BREAD}${BREAD}`
    , 'Popular in every country!'
    , `Why ${BREAD}? Why not!`
    , `I ${BREAD} you not!`
    , `got ${BREAD}?`
    , `How it feels to ${BREAD}`
    , `Think ${BREAD}`
    , `Just ${BREAD}`
    , `${BREAD} inside`
    , 'Bread is loafing around'
    , 'Baguette it?'
    , `I'm here to kick ass and ${BREAD}, and I'm all out of ass.`
    , `15 minutes could save you 15% or more on ${BREAD}`
    , 'Please stop burning bread'
    , 'Bread does not implement BREAD' // http://paul-m-jones.com/post/2008/08/20/bread-not-crud/
    , 'Welcome to the bread shop'
    , 'bread stonks'
  ]
  client.user.setActivity(randomElem(PRESENCE))
  if (client.data.started)
    return log.log(`ready again, serving ${client.guilds.size}`)

  client.data.started = true
  await initializeModules()
  log(`serving ${client.guilds.cache.size} servers`)
  log(`invite bot with: ${client.generateInvite({ scopes:['bot'], permissions: PERMISSIONS})}`)
}).on('error', err => {
  log.error('discord.js error: ', err)
  process.exit(1)
}).on('warn', log.curry('warn', 'client warning:'))
  .on('shardDisconnect', () => log('warning: disconnected'))
  .on('shardReconnecting', () => log('reconnecting...'))
  .on('shardResume', () => log.log('resumed'))
  .on('rateLimit', info => log.warn('ratelimit hit:', info))

if (process.env.PROJECT_INVITE_TOKEN) {
  // keep glitch.me alive
  require('./lib/web')(client)
} else client.login(env.token)
