const EventEmitter = require('events').EventEmitter
const util = require('util')

function Agent () { }

util.inherits(Agent, EventEmitter)

module.exports = Agent