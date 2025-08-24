#!/bin/bash
ME_LLAMARON_DESDE=$(pwd)
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd ../noctiluca-be/Api
dotnet build
cd $SCRIPT_DIR
swagger tofile --output swagger.json ../noctiluca-be/Api/bin/Debug/net8.0/Api.dll v1
nswag openapi2tsclient /input:swagger.json /output:./../noctiluca-fe/src/api/clients.ts
rm swagger.json
cd $ME_LLAMARON_DESDE