#!/bin/sh

uglifyjs ico.js > ico-min.js
uglifyjs es5.js > es5-min.js
uglifyjs json2.js > json2-min.js
uglifyjs prototype.js > prototype-min.js

cat es5-min.js json2-min.js ico-min.js > ico-es5-json2-min.js

