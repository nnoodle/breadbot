
module.exports.randomElem = arr => arr[Math.floor(Math.random() * arr.length)]
module.exports.clean = text => {
  text = text.toString()
  return text.replace(/[@`]/g, '$&' + String.fromCharCode(8203))
}
module.exports.isName = name => val => val.name === name
module.exports.wait = require('util').promisify(setTimeout)

const store = {} // to survive reloads
module.exports.store = store
module.exports.getStore = (key, fallback) => store[key] ? store[key] : (store[key] = fallback)

module.exports.fetchPartial = partialables => Promise.all(
  partialables.map(part => part.partial ? part.fetch() : part))

module.exports.rgb2hsv = (r,g,b) => {
  // https://www.rapidtables.com/convert/color/rgb-to-hsv.html
  r /= 255, g /= 255, b /= 255
  let cmax = Math.max(r, g, b)
  let cmin = Math.min(r, g, b)
  let delta = cmax - cmin

  let h
  if (delta === 0) h = 0
  else if (cmax === r) h = 60 * ((g - b)/delta % 6)
  else if (cmax === g) h = 60 * (b - r + 2)/delta
  else if (cmax === b) h = 60 * (r - g + 4)/delta

  const s = cmax ? delta/cmax : 0
  const v = cmax

  return [h,s,v]
}

module.exports.hsv2rgb = (h,s,v) => {
  // https://www.rapidtables.com/convert/color/hsv-to-rgb.html
  let c = v * s
  let x = c * (1 - Math.abs(h/60 % 2-1))
  let m = v - c

  let r, g, b
  if      (  0 <= h && h <  60) [r,g,b] = [c,x,0]
  else if ( 60 <= h && h < 120) [r,g,b] = [x,c,0]
  else if (120 <= h && h < 180) [r,g,b] = [0,c,x]
  else if (180 <= h && h < 240) [r,g,b] = [0,x,c]
  else if (240 <= h && h < 300) [r,g,b] = [x,0,c]
  else if (300 <= h && h < 360) [r,g,b] = [c,0,x]

  return [(r+m)*255, (g+m)*255, (b+m)*255]
}
