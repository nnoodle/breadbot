const Discord = require('discord.js')
const fetch = require('node-fetch')

const TENOR_URL_REGEXP = /https:\/\/tenor.com\/view\/\S+-gif-(\d+)/

function findTenorURL(messages) {
  const msg = messages.find(m => m.content.includes('https://tenor.com/view/'))
  if (!msg)
    return null

  const url = msg.content.match(TENOR_URL_REGEXP)
  return url[0]
}

async function fetchTenorView(url) {
  try {
    const html = await fetch(url).then(res => res.text())
    // hopefully I didn't summon Cthulhu with this mundane RegExp
    const match = html.match(/<script id="store-cache".+?(\{.*\})<\/script>/)
    if (!match)
      return null
    var json = JSON.parse(match[1])
  } catch(e) {
    console.log(e)
    return null
  }

  return json
}

module.exports.name = 'tenor'
module.exports.commands = [
  {
    name: 'tenor',
    usage: 'tenor TENOR-URL',
    description: 'Get information about Tenor GIF.',
    min_args: 0,
    dms: true,
    cooldown: 20,
    run: async msg => {
      const url = findTenorURL(msg.channel.messages.cache.array().reverse())
      if (!url)
        return msg.channel.send('error: could not find Tenor URL.')

      const tenor_view = await fetchTenorView(url)
      if (!tenor_view)
        return msg.channel.send('error: could not get Tenor information.')

      try {
        const json = tenor_view.gifs.byId[Object.keys(tenor_view.gifs.byId)[0]].results[0]
        const pfp_sizes = Object.keys(json.user.avatars)
        return msg.channel.send(
          {embeds: [
            new Discord.MessageEmbed()
              .setColor('DARK_BLUE')
              .setURL(url)
              .setTitle(json.h1_title)
            // .setImage(json.media[0].gif.url)
              .addField('ID', json.id, true)
              .addField('Author', `[${json.user.username}](${json.user.url})`, true)
              .addField('Tags', json.tags.map(t => '`'+t+'`').join(', '))
              .setAuthor(json.user.username,
                         json.user.avatars[pfp_sizes[pfp_sizes.length-1]],
                         json.user.url)
              .setFooter('Creation date', 'https://tenor.com/assets/img/favicon/favicon-32x32.png')
              .setTimestamp(json.created*1000)]})
      } catch(e) {
        return msg.channel.send('error: could not parse Tenor information')
      }
    }
  }
]
