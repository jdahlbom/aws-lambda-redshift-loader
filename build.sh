#!/bin/bash

ver=`cat package.json | grep version | cut -d: -f2 | sed -e "s/\"//g" | sed -e "s/ //g" | sed -e "s/\,//g"`

npm install
npm prune --production

zip -r AWSLambdaRedshiftLoader-$ver.zip index.js common.js createS3TriggerFile.js config.json kmsCrypto.js upgrades.js *.txt package.json node_modules/ && mv AWSLambdaRedshiftLoader-$ver.zip dist
