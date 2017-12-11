import { isArray, isEqual, isNumber, isObject, parseInt, take } from "lodash"

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

const getTF = name => ({
  t: o => Object.assign({ name, status: true }, o),
  f: o => Object.assign({ name, status: false }, o),
})

const backendExists = (object, path) => {
  const { t, f } = getTF("backendExists")

  if (path.length !== 0) { return null }
  
  if (!Object.keys(object).includes("backend")) {
    return f({
      message: "The config has no backend settings!",
      fix: () => Object.assign({}, object, { backend: {} }),
    })
  }

  return t({ message: "The config has backend settings." })
}

const validBackend = (object, path) => {
  const { t, f } = getTF("validBackend")
  
  if (!isEqual(path, ["backend"])) { return null }
  
  const validNames = [ "github", "git-gateway", "test-repo" ]
  if (!validNames.includes(object.name)) {
    return f({
      message: "The backend is not set or is unknown!",
      fix: async getInput => {
        const backendName = await getInput("Please choose a backend:", validNames)
        return Object.assign({}, object, { name: backendName })
      },
    })
  }

  return t({ message: "The chosen backend is valid." })
}

const repoExists = (object, path) => {
  const { t, f } = getTF("repoExists")

  if (!(isEqual(path, ["backend"]) && object.name === "github")) { return null }
  
  if (!object.repo || object.repo.split("/").length !== 2) {
    return f({
      message: "The backend does not have a valid repo name set!",
      fix: async getInput => {
        const repo = await getInput("Please enter the name of your GitHub repo, in the form \"user/repo\".")
        return Object.assign({}, object, { repo })
      }
    })
  }

  return t({ message: "The backend has a valid repo set." })
}

const collectionsExist = (object, path) => {
  const { t, f } = getTF("collectionsExist")

  if (!(path.length === 0)) { return null }

  if (!object.collections || object.collections.length === 0) {
    return f({
      message: "There are no collections defined!",
      fix: async () => Object.assign({}, object, { collections: [{}] })
    })
  }
  
  return t({ message: "There is at least one collection defined." })
}

const validateCollection = (object, path) => {
  const { t, f } = getTF("validateCollection")

  if (!(path.length === 2 && path[0] === "collections")) { return null }

  if (!object.name) {
    return f({
      message: object.label
        ? `The collection with the label "${ object.label } has no name!"`
        : "The collection has no name!",
      fix: async getInput => {
        const name = await getInput("Please enter a name for the collection: ")
        return Object.assign({}, object, { name })
      }
    })
  }
  
  if (!object.label) {
    return f({
      message: object.name
        ? `The collection "${ object.name }" has no label!`
        : "The collection has no label!",
      fix: async getInput => {
        const label = await getInput("Please enter a label for this collection: ")
        return Object.assign({}, object, { label })
      }
    })
  }

  if (!object.folder && !object.files) {
    return f({
      message: object.name
        ? `The collection ${ object.name } has no "folder" or "files"!`
        : "The collection has no \"folder\" or \"files\"",
      fix: async getInput => {
        const filesOrFolder = await getInput(
          "Please choose a collection type: ", ["files", "folder"]
        )

        if (filesOrFolder === "folder") {
          const folder = await getInput("Please enter the path to the folder: ")
          return Object.assign({}, object, { folder })
        }
        
        if (filesOrFolder === "files") {
          return Object.assign({}, object, { files: [] })
        }
      }
    })
  }
}

const rules = [backendExists, validBackend, repoExists, collectionsExist, validateCollection]

export const fixConfig = (getInput, object) => fixWithRules(getInput, rules, object)

export const examineConfig = (object) => runRules(rules, object)

export default examineConfig
