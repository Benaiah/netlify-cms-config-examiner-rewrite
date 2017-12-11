#!/usr/bin/env node

const fs = require("fs")
const { promisify } = require("util")
const minimist = require("minimist")
const yaml = require("js-yaml")
const inquirer = require("inquirer")

const { examineConfig, fixConfig } = require("../dist/bundle.js")

const argv = minimist(process.argv.slice(2))
const file = argv._[0]

if (!file) {
  console.error("You must pass a filename!")
  process.exit(1)
}

const getInput = async (query, choices) => {
  if (choices) {
    return inquirer.prompt([{
      name: "input",
      type: "list",
      message: query,
      choices,
    }]).then(a => a.input)
  }

  return inquirer.prompt([{
    name: "input",
    type: "input",
    message: query,
  }]).then(a => a.input)
}

const readFile = promisify(fs.readFile)

// readFile(file, "utf8")
//   .then(yaml.safeLoad)
Promise.resolve({})
  .then(config => fixConfig(getInput, config))
  .then(x => console.log(x) || x)
  .then(yaml.safeDump)
  .then(console.log)
  .catch(console.error)
