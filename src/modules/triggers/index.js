const TimerTrigger = require('./timer');
const CosTrigger = require('./cos');
const ApigwTrigger = require('./apigw');
const CkafkaTrigger = require('./ckafka');
const CmqTrigger = require('./cmq');
const ClsTrigger = require('./cls');
const MpsTrigger = require('./mps');

module.exports = {
  timer: TimerTrigger,
  cos: CosTrigger,
  apigw: ApigwTrigger,
  ckafka: CkafkaTrigger,
  cmq: CmqTrigger,
  cls: ClsTrigger,
  mps: MpsTrigger,
};
