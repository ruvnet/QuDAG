# get-stack-trace

[![Travis build status](http://img.shields.io/travis/gajus/get-stack-trace/master.svg?style=flat-square)](https://travis-ci.org/gajus/get-stack-trace)
[![Coveralls](https://img.shields.io/coveralls/gajus/get-stack-trace.svg?style=flat-square)](https://coveralls.io/github/gajus/get-stack-trace)
[![NPM version](http://img.shields.io/npm/v/get-stack-trace.svg?style=flat-square)](https://www.npmjs.org/package/get-stack-trace)
[![Canonical Code Style](https://img.shields.io/badge/code%20style-canonical-blue.svg?style=flat-square)](https://github.com/gajus/canonical)
[![Twitter Follow](https://img.shields.io/twitter/follow/kuizinas.svg?style=social&label=Follow)](https://twitter.com/kuizinas)

[V8 stack traces](https://github.com/v8/v8/wiki/Stack-Trace-API) with optional source map resolution.

## Motivation

A lot of NPM packages are transpiled either using Babel or TypeScript.

This means that if you attempt to resolve a [CallSite](https://github.com/v8/v8/wiki/Stack-Trace-API#customizing-stack-traces) using [`Error.prepareStackTrace`](https://github.com/v8/v8/wiki/Stack-Trace-API#customizing-stack-traces) and [`Error.captureStackTrace`](https://nodejs.org/api/errors.html#errors_error_capturestacktrace_targetobject_constructoropt), the resulting CallSite object will reference the tranpiled file, rather than the original source file. However, if the project was distributed with source maps, then we can use the available source maps to resolve the original CallSite.

In practise, this is useful if the intent is to log the stack trace of an application at a particular time in execution, e.g. Slonik [creates a stack trace prior to every asynchronous call](https://github.com/gajus/slonik#slonik-debugging-log-stack-trace) for debugging purposes.

For the stack traces to resolve, packages must be distributed with a source map file along with the transpiled file, e.g. such as in the case of this project:

```bash
$ cd ./dist && tree .
.
├── index.js
├── index.js.flow
├── index.js.map
├── test.js
├── test.js.flow
├── test.js.map
├── types.js
├── types.js.flow
└── types.js.map

```

## Usage

```js
import {
  getStackTrace
} from 'get-stack-trace';

const stackTrace = await getStackTrace();

```
