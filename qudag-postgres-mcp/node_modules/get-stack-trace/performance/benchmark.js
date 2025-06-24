/* eslint-disable promise/prefer-await-to-callbacks */
/* eslint-disable no-console */
/* eslint-disable import/unambiguous */
/* eslint-disable import/no-commonjs */
const benchmark = require('nodemark');
const {getStackTrace} = require('../dist');

(async () => {
  const result = await benchmark(async (callback) => {
    await getStackTrace();
    callback();
  });
  console.log(result);
})();
