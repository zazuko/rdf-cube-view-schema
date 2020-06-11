#!/usr/bin/env node

const debug = require('debug')('rdf-cube-view-schema')
const rdf = require('rdf-ext')
const TermMap = require('@rdfjs/term-map')
const { distinct, fromFile, indention, ns, toNT, toPropertyPath } = require('./utils')

function buildSparql (cf) {
  const view = cf.has(ns.rdf.type, ns.view.View)

  if (!view.term) {
    throw new Error('no unique view:View found')
  }

  debug(`found view at ${toNT(view.term)}`)

  const outputDimensions = view.out(ns.view.dimension)
  debug(`found ${outputDimensions.terms.length} output dimension(s)`)

  const filters = view.out(ns.view.filter)
  debug(`found ${filters.terms.length} filter(s)`)

  const filterDimensions = distinct(filters.out(ns.view.dimension))
  debug(`found ${filterDimensions.terms.length} filter dimension(s)`)

  const dimensions = distinct(view.node([...outputDimensions.terms, ...filterDimensions.terms]))
  debug(`found total ${dimensions.terms.length} dimension(s)`)

  const sources = distinct(dimensions.out(ns.view.from).out(ns.view.source))
  debug(`found ${sources.terms.length} source(s)`)

  const dimensionVars = new TermMap(dimensions.map((dimension, index) => {
    return [dimension.term, rdf.variable(`dimension${index}`)]
  }))

  return [
    `SELECT DISTINCT ${buildProjectionSparql({ dimensions, dimensionVars, view })} WHERE {`,
    indention(buildSourcesSparql({ sources, dimensionVars }), 2),
    indention(buildFiltersSparql({ filters, dimensionVars }), 2),
    '}',
    buildGroupSparql({ dimensions, dimensionVars }),
    buildHavingsSparql({ filters, dimensionVars })
  ].filter(Boolean).join('\n')
}

function buildProjectionSparql ({ dimensions, dimensionVars }) {
  return dimensions.map(dimension => {
    const aggregate = dimension.out(ns.view.aggregate)
    const dimensionVar = dimensionVars.get(dimension.term)

    if (aggregate.term) {
      if (aggregate.term.equals(ns.view.Min)) {
        return `(MIN(${toNT(dimensionVar)}) AS ${toNT(dimensionVar)})`
      }

      if (aggregate.term.equals(ns.view.Max)) {
        return `(MAX(${toNT(dimensionVar)}) AS ${toNT(dimensionVar)})`
      }

      if (aggregate.term.equals(ns.view.Avg)) {
        return `(AVG(${toNT(dimensionVar)}) AS ${toNT(dimensionVar)})`
      }

      throw new Error(`unknow aggregate ${aggregate.value}`)
    }

    return toNT(dimensionVar)
  }).join(' ')
}

function buildGroupSparql ({ dimensions, dimensionVars }) {
  const variables = dimensions.map(dimension => {
    const aggregate = dimension.out(ns.view.aggregate)
    const dimensionVar = dimensionVars.get(dimension.term)

    if (aggregate.term) {
      return null
    }

    return toNT(dimensionVar)
  }).filter(Boolean).join(' ')

  return `GROUP BY ${variables}`
}

function buildSourcesSparql ({ sources, dimensionVars }) {
  return sources.map((source, index) => {
    return buildSourceSparql({ index, source, dimensionVars })
  }).join('\n')
}

function buildSourceSparql ({ index, source, dimensionVars }) {
  const type = source.out(ns.rdf.type)

  if (type.term.equals(ns.view.CubeSource)) {
    return buildCubeSourceSparql({ index, source, dimensionVars })
  }

  if (type.term.equals(ns.view.LookupSource)) {
    return buildLookupSourceSparql({ source, dimensionVars })
  }

  return ''
}

function buildCubeSourceSparql ({ index, source, dimensionVars }) {
  const froms = source.in(ns.view.source)
  const observationSet = rdf.variable(`observationSet${index}`)
  const observation = rdf.variable(`observation${index}`)

  // TODO: graph
  // TODO: endpoint
  // TODO: optional

  const patterns = [
    rdf.quad(source.out(ns.view.cube).term, ns.cube.observationSet, observationSet),
    rdf.quad(observationSet, ns.cube.observation, observation)
  ].concat(froms.map(from => {
    const dimension = from.in(ns.view.from)
    const dimensionVar = dimensionVars.get(dimension.term)
    const path = toPropertyPath(from.out(ns.view.path))

    // dimension is not used
    if (!dimensionVar) {
      return null
    }

    return rdf.quad(observation, path, dimensionVar)
  })).filter(Boolean).map(pattern => toNT(pattern)).join('\n')

  return patterns
}

function buildLookupSourceSparql ({ source, dimensionVars }) {
  const froms = source.in(ns.view.source)

  // TODO: graph
  // TODO: endpoint
  // TODO: optional

  const patterns = froms.map(from => {
    const dimension = from.in(ns.view.from)
    const dimensionVar = dimensionVars.get(dimension.term)
    const join = from.out(ns.view.join)
    const joinVar = dimensionVars.get(join.term)
    const path = toPropertyPath(from.out(ns.view.path))

    return rdf.quad(joinVar, path, dimensionVar)
  }).map(pattern => toNT(pattern)).join('\n')

  return patterns
}

function buildFiltersSparql ({ filters, dimensionVars }) {
  const rules = filters.map(filter => {
    return buildFilterSparql({ filter, dimensionVars })
  }).filter(Boolean).join(' &&\n')

  if (!rules) {
    return null
  }

  return [
    'FILTER (',
    indention(rules, 2),
    ')'
  ].join('\n')
}

function buildHavingsSparql ({ filters, dimensionVars }) {
  const rules = filters.map(filter => {
    return buildFilterSparql({ filter, dimensionVars, aggregates: true })
  }).filter(Boolean).join(' &&\n')

  if (!rules) {
    return null
  }

  return [
    'HAVING (',
    indention(rules, 2),
    ')'
  ].join('\n')
}

function buildFilterSparql ({ filter, dimensionVars, aggregates }) {
  const dimension = filter.out(ns.view.dimension)
  const dimensionVar = dimensionVars.get(dimension.term)
  const aggregate = dimension.out(ns.view.aggregate)
  const operation = filter.out(ns.view.operation)
  const argument = filter.out(ns.view.argument)

  // TODO: optional

  if (Boolean(aggregate.term) !== Boolean(aggregates)) {
    return null
  }

  if (operation.term.equals(ns.view.Gte)) {
    return `(${toNT(dimensionVar)} >= ${toNT(argument.term)})`
  }

  if (operation.term.equals(ns.view.Lte)) {
    return `(${toNT(dimensionVar)} <= ${toNT(argument.term)})`
  }

  throw new Error(`unknown filter type: ${operation.value}`)
}

async function main (filename) {
  const data = await fromFile(filename)

  debug(`parsed ${data.dataset.size} triples from ${filename}`)

  console.log(buildSparql(data))
}

main(process.argv[2])
