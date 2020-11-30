#!/usr/bin/env bash

yarn build
# publish package to github npm package
npm publish
# create release tarball and hash file
rm -f *.tgz{,.sha1sum.txt} && npm pack && sha1sum *.tgz > "$(ls *.tgz | head -n 1).sha1sum.txt"
