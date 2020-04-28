const { EventEmitter } = require('events')
const util = require('util')

function Agent() {}

util.inherits(Agent, EventEmitter)

module.exports = Agent
