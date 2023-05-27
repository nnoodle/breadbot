const Discord = require('discord.js')
const path = require('path')
const http = require('http')
const express = require('express')
const fs = require('fs').promises
const log = require('./logger')

const env = Object.assign({ ownerid: '_', datadir:'data/' }, require('../env'))
const app = express()
const enabled_file = path.join(env.datadir, 'status')

async function getToggle() {
  try {
    return JSON.parse(await fs.readFile(enabled_file, { encoding: 'utf8' }))
  } catch(e) {
    if (e.code === 'ENOENT')
      return true
    throw e
  }
}

async function setToggle(on) {
  await fs.writeFile(enabled_file, JSON.stringify(on))
}

function start(client) {
  app.get('/', (_req, resp) => {
    resp.sendStatus(200)
  })
  app.get('/uptime', (_req, resp) => resp.send(Math.ceil(process.uptime()).toString()))
  app.use('/admin', (req, resp, next) => {
    if (!process.env.SECRET) {
      log('error on /admin request: no secret set')
      return resp.sendStatus(500)
    }
    if (req.get('Authorization') !== process.env.SECRET) {
      log('                             ', JSON.stringify(process.env.SECRET), req.get('Authorization') !== process.env.SECRET)
      log('failed authorization attempt:', JSON.stringify(req.get('Authorization')))
      return resp.sendStatus(401)
    }
    return next()
  })
  app.get('/admin/toggle', async (req, resp) => {
    const turn_on = req.query.on
          ? JSON.parse(req.query.on)
          : (client.status === Discord.Constants.Status.DISCONNECTED)
    await setToggle(turn_on)
    if (turn_on)
      client.login(env.token)
    else
      client.destroy()
    resp.send(turn_on.toString())
  })

  app.listen(process.env.PORT)

  setInterval(() => http.get(`http://${process.env.PROJECT_DOMAIN}.glitch.me/`), 240000)
  log('keeping glitch.me alive')

  client.data.app = app
  getToggle().then(on => on && client.login(env.token))

  return app
}

module.exports = start
