
function stringOperator(x, op, y) {
  switch (op) {
  case '-':
    return x - y
  case '*':
  case '⋅':
  case '×':
    return x * y
  case '/':
  case '÷':
    return x / y
  case '^':
    return x ** y
  default:
    return x + y
  }
}

function rollxds(x, s) {
  let t = 0
  while (x--)
    t += Math.floor(Math.random() * s) + 1
  return t
}

function parseDiceOrInt(dice) {
  const clamp = (n, min, max) => Math.max(Math.min(n,max),min)
  const re = /(?<amount>\d+)?d(?<sides>\d+)(?:k(?<keep>\d+)|p(?<drop>\d+))?/.exec(dice)
  if (!re) {
    const val =  parseInt(dice) || 0
    return {text: val.toString(), val}
  }

  const matches = re.groups
  const amount = clamp(parseInt(matches.amount)||1, 1, 100)
  const sides = clamp(parseInt(matches.sides)||6, 1, 0x4000)
  // we want to keep the original order of the dice rolls, but still sort it
  let rolls = (new Array(amount)).fill(0)
      .map((_,i) => new Object({v:rollxds(1, sides), i}))
      .sort((a,b) => b.v - a.v)
  let rm
  if (rm = clamp(matches.keep, 0, amount)) // eslint-disable-line no-cond-assign
    rolls.slice(rm).map(x => Object.assign(x, {rm: true}))
  else if (rm = clamp(matches.drop, 0, amount)) // eslint-disable-line no-cond-assign
    rolls.slice(0,amount-rm).map(x => Object.assign(x, {rm: true}))

  const STRIKE = '`~~`'
  return {
    text: '('+rolls.sort((a, b) => a.i - b.i)
      .map(x => `${x.rm ? STRIKE:''}${(x.i === 0 ? '':'+')}${x.v}${x.rm ? STRIKE:''}`)
      .join('').replace(/`~~``~~`/g, '')+')',
    val: rolls.reduce((acc,cur) => cur.rm ? acc : acc+cur.v, 0)
  }
}

function parseExpr(expr, p = { text: '', val: 0 }) {
  if (!p.orig)
    p.orig = expr

  const re = /(\+|-|\*|⋅|×|\/|÷|\^)/

  // add initial operator
  if (!re.test(expr[0]))
    expr = '+' + expr

  let [op, num, ...rest] = expr.split(re).slice(1)

  num = parseDiceOrInt(num)
  // const isdice = Array.isArray(num)
  let result = {
    text: (p.text ? p.text+` ${op} ` : '')+num.text,
    val: stringOperator(p.val, op, num.val),
    orig: p.orig
  }

  if (!rest || rest.length > 0)
    return parseExpr(rest.join(''), result)
  else
    return result
}

// "d4;1d20+9;1d8+1d4+2d6+1d4;+1 ! <comment>"
function parseRollString(roll) {
  // remove comments
  let parsed = {}
  let comment
  [roll, ...comment] = roll.split('!')
  if (comment)
    parsed.comment = comment.join('!').trim()
  parsed.rolls = roll
    .replace(/\s/g, '')
    .split(';')
    .filter(x => x) // remove blanks
    .map(x => parseExpr(x))
  return parsed
}

module.exports = parseRollString
