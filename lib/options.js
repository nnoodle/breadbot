const { isName } = require('./util')


module.exports.get = async (guild, name) => {
  await guild.client.data.guilds
    .ensure(guild.id, guild.client.data.configs[name].init, name)
  return await guild.client.data.guilds.get(guild.id, name)
}

module.exports.parseChannel = ([input]) => input.match(/(?:<#)?(\d+)>?/)[1]
module.exports.printChannel = value => value ? `<#${value}>` : ''
module.exports.getChannel = async (guild, opt, fallbacks) => {
  await guild.client.data.guilds.ensure(guild.id, '', opt)

  const fetched = guild.channels.cache.get(await guild.client.data.guilds.get(guild.id, opt))
  if (fetched)
    return fetched

  const find = fallbacks.find(c => guild.channels.cache.find(isName(c)))
  if (find) {
    const channel = guild.channels.cache.find(isName(find))
    await guild.client.data.guilds.set(guild.id, channel.id, opt)
    return channel
  }
  return undefined
}

module.exports.parseInteger =
  (min_int=Math.MIN_SAFE_INTEGER, max_int=Math.MAX_SAFE_INTEGER) => {
  return ([number]) => {
    const num = Number.parseInt(number)
    if (!Number.isSafeInteger(num))
      throw new Error('not an acceptable number')
    return Math.min(Math.max(num, min_int), max_int)
  }
}
