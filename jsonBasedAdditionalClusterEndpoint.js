/*
 Copyright 2014-2015 Amazon.com, Inc. or its affiliates. All Rights Reserved.

 Licensed under the Amazon Software License (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

 http://aws.amazon.com/asl/

 or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

var aws = require('aws-sdk');
var conf = require('./config.json');
var kmsCrypto = require('./kmsCrypto');
var common = require('./common');
var async = require('async');

var setRegion = conf.const.aws_region;

var configuration = require('./setupConfiguration.json');

// simple frame for the updated cluster config
var clusterConfig = {
	M : {

	}
};

var updateRequest = {
	Key : {
		s3Prefix : undefined
	},
	TableName : conf.table.config,
	UpdateExpression : "SET loadClusters = list_append(loadClusters, :newLoadCluster),lastUpdate = :updateTime",
	ExpressionAttributeValues : {
		":newLoadCluster" : null,
		":updateTime" : {
			N : '' + common.now()
		}
	}
};


var dynamoDB = new aws.DynamoDB({
	apiVersion: '2012-08-10',
	region: setRegion
});
kmsCrypto.setRegion(setRegion);

updateRequest.Key.s3Prefix = {
	S : configuration.s3prefix
};

clusterConfig.M.clusterEndpoint = {
	S : configuration.cluster.endpoint
};

clusterConfig.M.clusterPort = {
	N : configuration.cluster.port
};

clusterConfig.M.useSSL = {
	BOOL : confguration.cluster.sslUsed
};

clusterConfig.M.clusterEndpoint = {
	S : configuration.cluster.endpoint
};
clusterConfig.M.clusterPort = {
	N : configuration.cluster.port
};
clusterConfig.M.useSSL = {
	BOOL : configuration.cluster.sslUsed
};
clusterConfig.M.clusterDB = {
	S : configuration.cluster.database
};
clusterConfig.M.connectUser = {
	S : configuration.cluster.username
};
clusterConfig.M.targetTable = {
	S : configuration.cluster.table
};
clusterConfig.M.columnList = {
	S : configuration.cluster.columnListCsv
};
clusterConfig.M.truncateTarget = {
	BOOL : configuration.cluster.truncateTable
};

q_userPwd = function(callback) {
	kmsCrypto.encrypt(configuration.cluster.password, function(err, ciphertext) {
		if (err) {
			console.log(JSON.stringify(err));
			process.exit(conf.const.ERROR);
		}
		clusterConfig.M.connectPassword = {
			S : kmsCrypto.toLambdaStringFormat(ciphertext)
		};
		callback(null);
	});
};

addClusterToPrefix = function(callback, overrideConfig) {
	var useConfig = clusterConfig;

	if (overrideConfig) {
		useConfig = overrideConfig;
	}

	// add the Expression Attribute Value for the new config section to the
	// request as a list of 1 Map item
	updateRequest.ExpressionAttributeValues[":newLoadCluster"] = {
		"L" : [ useConfig ]
	};

	// update the configuration
	common.updateConfig(setRegion, dynamoDB, updateRequest, callback);
};

qs.push(q_userPwd);
qs.push(addClusterToPrefix);
async.waterfall(qs);
