#!/usr/bin/env node

require("fetch-everywhere")

const fs = require("fs")
const { promisify } = require("util")
const minimist = require("minimist")
const yaml = require("js-yaml")
const inquirer = require("inquirer")

const { examineConfig, fixConfig } = require("../dist/bundle.js")

const argv = minimist(process.argv.slice(2))

if (argv.help || argv.h) {
  console.log("Usage: netlify-cms-examiner path/to/config.yml")
  process.exit(0)
}

const file = argv._[0]

const createCommand = (name, description, fn) => {
  const commandArgs = argv._.slice(1)
}

if (!file) {
  console.error("You must pass a filename!")
  process.exit(1)
}

const getInput = {
  text: (message) => inquirer.prompt([{
    type: "input",
    name: "value",
    message,
  }]).then(({ value }) => value),
  choose: (message, choices) => inquirer.prompt([{
    type: "list",
    name: "value",
    message,
    choices,
  }]).then(({ value }) => value),
}

const readFile = promisify(fs.readFile)

readFile(file, "utf8")
  .then(yaml.safeLoad)
  .then(config => fixConfig(getInput, config))
  .then(yaml.safeDump)
  .then(console.log)
  .catch(console.error)
