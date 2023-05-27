
const timestamp = () => `[${new Date().toISOString()}]`

function storeLog(level, args) {
  module.exports.logs.unshift({ timestamp: new Date(), args, level })
  if (module.exports.logs.length > 100)
    module.exports.logs.pop()
}

function makeLogger(method) {
  const level = method === 'log' ? 'info' : method
  return (...args) => {
    storeLog(level, args)
    console[method](timestamp(), ...args)
  }
}

module.exports = makeLogger('log')

module.exports.logs = []

module.exports.log = makeLogger('log') // alias
module.exports.warn = makeLogger('warn')
module.exports.error = makeLogger('error')
module.exports.curry = (method, ...preargs) =>
  (...args) => makeLogger(method)(...preargs.concat(args))
