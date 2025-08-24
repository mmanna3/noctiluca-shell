#!/bin/bash
cd ..
cd noctiluca-fe
yarn
yarn build
cp -rf ./build/. ./../noctiluca-be/Api/wwwroot