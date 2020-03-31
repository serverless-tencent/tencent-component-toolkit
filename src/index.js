const Apigw = require('./baas/apigw')
const Cdn = require('./baas/cdn')
const Cns = require('./baas/cns')
const Cos = require('./baas/cos')
const Domain = require('./baas/domain')
const MultiApigw = require('./baas/multi-apigw')
const MultiScf = require('./baas/multi-scf')
const Scf = require('./baas/scf')
const Tag = require('./baas/tag')

module.exports = {
  Apigw,
  Cdn,
  Cns,
  Cos,
  Domain,
  MultiApigw,
  MultiScf,
  Scf,
  Tag
}
