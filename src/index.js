const Apigw = require('./baas/apigw')
const Cdn = require('./baas/cdn')
const Cns = require('./baas/cns')
const Cos = require('./baas/cos')
const Domain = require('./baas/domain')
const MultiApigw = require('./baas/multi-apigw')
const MultiScf = require('./baas/multi-scf')
const Scf = require('./baas/scf')
const Tag = require('./baas/tag')
const Postgresql = require('./baas/postgresql')
const Vpc = require('./baas/vpc')
const Cam = require('./baas/cam')
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
  Cam
}
