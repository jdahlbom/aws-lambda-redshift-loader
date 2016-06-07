/*
 Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.

 Licensed under the Amazon Software License (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

 http://aws.amazon.com/asl/

 or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * Ask questions of the end user via STDIN and then setup the DynamoDB table
 * entry for the configuration when done
 */
var pjson = require('./package.json');
var aws = require('aws-sdk');
var common = require('./common');
var conf = require('./config.json');
var async = require('async');
var uuid = require('node-uuid');

var kmsCrypto = require('./kmsCrypto');

var configuration = require('./jsonBasedSetup.js');

var setRegion = configuration.region;

// configure dynamo db and kms for the correct region
var dynamoDB = new aws.DynamoDB({
    apiVersion : '2012-08-10',
    region : setRegion
});
kmsCrypto.setRegion(setRegion);


var dynamoConfig = {
    TableName : conf.table.config,
    Item : {
        currentBatch : {
            S : uuid.v4()
        },
        version : {
            S : pjson.version
        },
        loadClusters : {
            L : [ {
                M : {

                }
            } ]
        }
    }
};

dynamoConfig.Item.s3Prefix = {
    S : configuration.s3prefix
};
dynamoConfig.Item.filenameFilterRegex = {
    S : configuration.filenameFilterRegex
};
dynamoConfig.Item.loadClusters.L[0].M.clusterEndpoint = {
    S : configuration.cluster.endpoint
};
dynamoConfig.Item.loadClusters.L[0].M.clusterPort = {
    N : configuration.cluster.port
};
dynamoConfig.Item.loadClusters.L[0].M.useSSL = {
    BOOL : configuration.cluster.sslUsed
};
dynamoConfig.Item.loadClusters.L[0].M.clusterDB = {
    S : configuration.cluster.database
};
dynamoConfig.Item.loadClusters.L[0].M.connectUser = {
    S : configuration.cluster.username
};
dynamoConfig.Item.loadClusters.L[0].M.targetTable = {
    S : configuration.cluster.table
};
dynamoConfig.Item.loadClusters.L[0].M.columnList = {
    S : configuration.cluster.columnListCsv
};
dynamoConfig.Item.loadClusters.L[0].M.truncateTarget = {
    BOOL : configuration.cluster.truncateTable
};
dynamoConfig.Item.dataFormat = {
    S : configuration.cluster.format
};
dynamoConfig.Item.csvDelimiter = {
    S : configuration.cluster.delimiter
};
dynamoConfig.Item.manifestBucket = {
    S : configuration.manifestBucket
};
dynamoConfig.Item.manifestKey = {
    S : configuration.manifestPrefix
};
dynamoConfig.Item.failedManifestKey = {
    S : configuration.failedManifestPrefix
};
dynamoConfig.Item.redshiftS3RoleArn = {
    S : configuration.redshiftS3RoleArn
};

if (configuration.sns.failureTopicArn)
    dynamoConfig.Item.failureTopicARN = {
        S : configuration.sns.failureTopicArn
    };

if (configuration.sns.successTopicArn) {
    dynamoConfig.Item.successTopicARN = {
        S : configuration.sns.successTopicArn
    };
}

if (configuration.batchSize) {
    dynamoConfig.Item.batchSize = {
        N : configuration.batchSize
    };
}

if (configuration.batchTimeout) {
    dynamoConfig.Item.batchTimeoutSecs = {
        N : configuration.batchTimeout
    };
}

if (configuration.cluster.copyOpts) {
    dynamoConfig.Item.copyOptions = {
        S : configuration.cluster.copyOpts
    };
}

q_userPwd = function(callback) {
    kmsCrypto.encrypt(configuration.cluster.password, function(err, ciphertext) {
        if (err) {
            console.log(JSON.stringify(err));
            process.exit(conf.const.ERROR);
        }
        dynamoConfig.Item.loadClusters.L[0].M.connectPassword = {
            S : kmsCrypto.toLambdaStringFormat(ciphertext)
        };
        callback(null);
    });
};

q_symmetricKey = function(callback) {
    if (configuration.encryptedFilesKey) {
        kmsCrypto.encrypt(configuration.encryptedFilesKey, function(err, ciphertext) {
            if (err) {
                console.log(JSON.stringify(err));
                process.exit(conf.const.ERROR);
            }
            dynamoConfig.Item.masterSymmetricKey = {
                S : kmsCrypto.toLambdaStringFormat(ciphertext)
            };
            callback(null);
        });
    } else {
        callback(null);
    }
};

var setup = function(error, callback) {
    var configWriter = common.writeConfig(setRegion, dynamoDB, dynamoConfig, callback);
    callback(null);
};

qs.push(q_userPwd);
qs.push(q_symmetricKey);
qs.push(setup);

async.waterfall(qs);
