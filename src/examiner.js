import { isArray, isEqual, isNumber, isObject, partial, parseInt, take } from "lodash"

/*
  A rule is simply an async function that returns either `null` as an
  indication that the rule did not apply or an object with the
  following keys:

  - name
  - status
  - message
  - fix
*/

const runRules = async (rules, object, path = []) => {
  let results = []
  for (const rule of rules) {
    const result = await rule(object, path)
    if (result) {
      if (result.fix) { delete result.fix }
      results.push(result)
    }
  }

  if (!(isArray(object) || isObject(object))) {
    return results
  }

  const keys = Object.keys(object)
  if (keys.length > 0) {
    for (const key of keys) {
      const subPath = [...path, key]
      const property = object[key]
      if (isArray(property) || isObject(property)) {
        const subResults = await runRules(rules, object[key], subPath)
        results = results.concat(subResults)
      }
    }
  }

  return results
}

const fixWithRule = async (getInput, rule, object, path) => {
  const result = await rule(object, path)
  if (result && !result.status && result.fix) {
    console.error(result.message)
    const fixedObject = await result.fix(getInput)
    return fixWithRule(getInput, rule, fixedObject, path)
  }

  return object
}

const fixWithRules = async (getInput, rules, object, path = []) => {
  let workingObject = object
  let results = []
  for (const rule of rules) {
    workingObject = await fixWithRule(getInput, rule, workingObject, path)
  }

  if (!(isArray(workingObject) || isObject(workingObject))) {
    return workingObject
  }

  const keys = Object.keys(workingObject)
  if (keys.length > 0) {
    for (const key of keys) {
      const subPath = [...path, key]
      const property = workingObject[key]
      if (isArray(property) || isObject(property)) {
        const fixedProperty = await fixWithRules(getInput, rules, property, subPath)
        workingObject = isArray(workingObject)
          ? Object.assign([], workingObject, { [key]: fixedProperty })
          : Object.assign({}, workingObject, { [key]: fixedProperty })
      }
    }
  }

  return workingObject
}

const
  pass = name => o => Object.assign({ name, status: true }, o),
  fail = name => o => Object.assign({ name, status: false }, o),
  createRule = (name, fn) => partial(fn, pass(name), fail(name));

const backendExists = createRule("backendExists", (pass, fail, object, path) => {
  if (path.length !== 0) { return null }

  if (!Object.keys(object).includes("backend")) {
    return fail({
      message: "The config has no backend settings!",
      fix: () => Object.assign({}, object, { backend: {} }),
    })
  }

  return pass({ message: "The config has backend settings." })
})

const validBackend = createRule("validBackend", (pass, fail, object, path) => {
  if (!isEqual(path, ["backend"])) { return null }

  const validNames = ["github", "git-gateway", "test-repo"]
  if (!validNames.includes(object.name)) {
    return fail({
      message: "The backend is not set or is unknown!",
      fix: async getInput => {
        const backendName = await getInput.choose("Please choose a backend:", validNames)
        return Object.assign({}, object, { name: backendName })
      },
    })
  }

  return pass({ message: "The chosen backend is valid." })
})

const repoExists = createRule("repoExists", (pass, fail, object, path) => {
  if (!(isEqual(path, ["backend"]) && object.name === "github")) { return null }

  const requestRepo = async getInput => {
    const repo = await getInput.text("Please enter the name of your GitHub repo, in the form \"user/repo\".")
    return Object.assign({}, object, { repo })
  }

  if (!object.repo || object.repo.split("/").length !== 2) {
    return fail({
      message: "The backend does not have a valid repo name set!",
      fix: requestRepo,
    })
  }

  return fetch(`https://api.github.com/repos/${object.repo}`, { method: "HEAD" })
    .then(response => response.status === 404
      ? fail({
        message: `The repo "${object.repo}" does not exist - please enter another.`,
        fix: requestRepo,
      })
      : pass({ message: "The backend has a valid repo set." }))
})

const collectionsExist = createRule("collectionsExist", (pass, fail, object, path) => {
  if (!(path.length === 0)) { return null }

  if (!object.collections || object.collections.length === 0) {
    return fail({
      message: "There are no collections defined!",
      fix: async () => Object.assign({}, object, { collections: [{}] })
    })
  }

  return pass({ message: "There is at least one collection defined." })
})

const validateCollection = createRule("validateCollection", (pass, fail, object, path) => {
  if (!(path.length === 2 && path[0] === "collections")) { return null }

  if (!object.name) {
    return fail({
      message: object.label
        ? `The collection with the label "${object.label} has no name!"`
        : "The collection has no name!",
      fix: async getInput => {
        const name = await getInput.text("Please enter a name for the collection:")
        console.log(name)
        return Object.assign({}, object, { name })
      }
    })
  }

  if (!object.label) {
    return fail({
      message: object.name
        ? `The collection "${object.name}" has no label!`
        : "The collection has no label!",
      fix: async getInput => {
        const label = await getInput.text("Please enter a label for this collection: ")
        return Object.assign({}, object, { label })
      }
    })
  }

  if (!object.folder && !object.files) {
    return fail({
      message: object.name
        ? `The collection ${object.name} has no "folder" or "files"!`
        : "The collection has no \"folder\" or \"files\"",
      fix: async getInput => {
        const filesOrFolder = await getInput.choose(
          "Please choose a collection type: ", ["files", "folder"]
        )

        if (filesOrFolder === "folder") {
          const folder = await getInput.text("Please enter the path to the folder: ")
          return Object.assign({}, object, { folder })
        }

        if (filesOrFolder === "files") {
          return Object.assign({}, object, { files: [] })
        }
      }
    })
  }

  return pass({ message: "Collection has required properties." });
})

const rules = [backendExists, validBackend, repoExists, collectionsExist, validateCollection]

export const fixConfig = (getInput, object) => fixWithRules(getInput, rules, object)

export const examineConfig = (object) => runRules(rules, object)

export default examineConfig
