#!/usr/bin/env node

const debug = require('debug')('rdf-cube-view-schema')
const ViewQuery = require('rdf-cube-view-query/lib/query/ViewQuery')
const { fromFile, ns } = require('./utils')

async function main (filename) {
  const data = await fromFile(filename)

  debug(`parsed ${data.dataset.size} triples from ${filename}`)

  const view = data.has(ns.rdf.type, ns.view.View)

  if (!view.term) {
    throw new Error('no unique view:View found')
  }

  const viewQuery = new ViewQuery(view)

  console.log(viewQuery.query.toString())
}

main(process.argv[2])
