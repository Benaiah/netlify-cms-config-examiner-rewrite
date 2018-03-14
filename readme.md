# Netlify CMS Config Examiner

* Fully asynchronous
* Supports both linting and fixing configs
* Runs in both node and browser environments
* Input helpers are passed in as arguments, so fixes can be resolved with arbitrary UI.

To try it out:

```sh
$ git clone git@github.com:benaiah/netlify-cms-config-examiner-rewrite
$ yarn && yarn run build
$ npm i -g . # yarn doesn't support this yet
$ netlify-cms-examiner path/to/config.yml
```

The tool currently dumps its output instead of writing a file.

The core code and current rules are contained in `src/examiner.js`, and
the CLI utility is contained in `cli/index.js`.
