const namespace = require('@rdfjs/namespace')
const clownface = require('clownface')
const rdf = require('rdf-ext')
const { fromFile: streamFromFile } = require('rdf-utils-fs')

const ns = {
  cube: namespace('http://ns.bergnet.org/cube/'),
  rdf: namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#'),
  view: namespace('http://ns.bergnet.org/cube-view/'),
  xsd: namespace('http://www.w3.org/2001/XMLSchema#')
}

async function fromFile (path) {
  return clownface({ dataset: await rdf.dataset().import(streamFromFile(path)) })
}

module.exports = {
  ns,
  fromFile
}
