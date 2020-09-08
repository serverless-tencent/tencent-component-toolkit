const Apigw = require('./modules/apigw');
const Cdn = require('./modules/cdn');
const Cns = require('./modules/cns');
const Cos = require('./modules/cos');
const Domain = require('./modules/domain');
const MultiApigw = require('./modules/multi-apigw');
const MultiScf = require('./modules/multi-scf');
const Scf = require('./modules/scf');
const Tag = require('./modules/tag');
const Postgresql = require('./modules/postgresql');
const Vpc = require('./modules/vpc');
const Cam = require('./modules/cam');
const Metrics = require('./modules/metrics');
const Layer = require('./modules/layer');
const Cfs = require('./modules/cfs');

module.exports = {
  Apigw,
  Cdn,
  Cns,
  Cos,
  Domain,
  MultiApigw,
  MultiScf,
  Scf,
  Tag,
  Postgresql,
  Vpc,
  Cam,
  Metrics,
  Layer,
  Cfs,
};
