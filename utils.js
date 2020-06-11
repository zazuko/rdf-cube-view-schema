const clownface = require('clownface')
const rdf = require('rdf-ext')
const { fromFile: streamFromFile } = require('rdf-utils-fs')
const namespace = require('@rdfjs/namespace')
const TermSet = require('@rdfjs/term-set')
const { termToNTriples } = require('@rdfjs/to-ntriples')

const ns = {
  cube: namespace('http://ns.bergnet.org/cube/'),
  rdf: namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#'),
  view: namespace('http://ns.bergnet.org/cube-view/'),
  xsd: namespace('http://www.w3.org/2001/XMLSchema#')
}

function distinct (ptr) {
  const terms = [...new TermSet(ptr.terms)]

  return clownface({
    dataset: ptr._context[0].dataset,
    term: terms,
    graph: ptr._context[0].graph
  })
}

async function fromFile (path) {
  return clownface({ dataset: await rdf.dataset().import(streamFromFile(path)) })
}

function indention (str, width) {
  if (str === null) {
    return null
  }

  let spaces = ''

  for (; spaces.length < width; spaces += ' ') {}

  return str.split('\n').map(line => spaces + line).join('\n')
}

function quadToNT (quad) {
  const subjectString = toNT(quad.subject)
  const predicateString = toNT(quad.predicate)
  const objectString = toNT(quad.object)
  const graphString = toNT(quad.graph)

  return `${subjectString} ${predicateString} ${objectString} ${graphString ? graphString + ' ' : ''}.`
}

function toNT (obj) {
  if (!obj.termType || obj.termType === 'Quad') {
    return quadToNT(obj)
  }

  if (obj.termType === 'PropertyPath') {
    return obj.value.map(property => termToNTriples(property)).join('/')
  }

  return termToNTriples(obj)
}

function toPropertyPath (ptr) {
  const list = [...ptr.list()]

  if (!list[0].term) {
    return ptr.term
  }

  return {
    termType: 'PropertyPath',
    value: list.map(property => property.term)
  }
}

module.exports = {
  ns,
  distinct,
  fromFile,
  indention,
  toNT,
  toPropertyPath
}
