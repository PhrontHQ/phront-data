var AWS = require('aws-sdk'),
    S3 =  AWS.S3,
    DataService = require("montage/data/service/data-service").DataService,
    RawDataService = require("montage/data/service/raw-data-service").RawDataService,
    SyntaxInOrderIterator = require("montage/core/frb/syntax-iterator").SyntaxInOrderIterator,
    DataOperation = require("montage/data/service/data-operation").DataOperation,
    S3DataService;



/**
* TODO: Document
*
* @class
* @extends RawDataService
*/
exports.S3DataService = S3DataService = RawDataService.specialize(/** @lends S3DataService.prototype */ {

    /***************************************************************************
     * Initializing
     */

    constructor: {
        value: function S3DataService() {
            RawDataService.call(this);

            var mainService = DataService.mainService;
            mainService.addEventListener(DataOperation.Type.Read,this,false);


            return this;
        }
    },

    handleCreateTransaction: {
        value: function (createTransactionOperation) {

            /*
                S3 doesn't have the notion of transaction, but we still need to find a way to make it work.
            */

        }
    },

    _connection: {
        value: undefined
    },

    connection: {
        get: function() {
            if(!this._connection) {
                this.connection = this.connectionForIdentifier(this.currentEnvironment.stage);
            }
            return this._connection;
        },
        set: function(value) {

            if(value !== this._connection) {
                this._connection = value;
            }
        }
    },

    __S3Client: {
        value: undefined
    },

    _S3Client: {
        get: function () {
            if (!this.__S3Client) {
                var connection = this.connection;

                if(connection) {
                    var region;

                    if(connection.bucketRegion) {
                        region = connection.bucketRegion;
                    } else if(connection.resourceArn) {
                        region = connection.resourceArn.split(":")[3];
                    }

                    var S3DataServiceOptions =  {
                        apiVersion: '2006-03-01',
                        region: region
                    };

                    var credentials = new AWS.SharedIniFileCredentials({profile: connection.profile});
                    if(credentials && credentials.accessKeyId !== undefined && credentials.secretAccessKey !== undefined) {
                        S3DataServiceOptions.credentials = credentials;
                    } else {
                        S3DataServiceOptions.accessKeyId = process.env.aws_access_key_id;
                        S3DataServiceOptions.secretAccessKey = process.env.aws_secret_access_key;
                    }

                    this.__S3Client = new AWS.S3(S3DataServiceOptions);

                } else {
                    throw "S3DtaService could not find a connection for stage - "+this.currentEnvironment.stage+" -";
                }

            }
            return this.__S3Client;
        }
    },

    handleExpiringObjectDownloadRead: {
        value: function (readOperation) {
            /*
                Until we solve more efficiently (lazily) how RawDataServices listen for and receive data operations, we have to check wether we're the one to deal with this:
            */
            if(!this.handlesType(readOperation.target)) {
                return;
            }

            //console.log("S3DataService - handleObjectRead");

            var self = this,
                data = readOperation.data,
                objectDescriptor = readOperation.target,
                mapping = objectDescriptor && this.mappingForType(objectDescriptor),
                primaryKeyPropertyDescriptors = mapping && mapping.primaryKeyPropertyDescriptors,

                criteria = readOperation.criteria,
                parameters = criteria.parameters,
                //We "know the pr
                readExpressions = readOperation.data.readExpressions,
                // iterator = new SyntaxInOrderIterator(criteria.syntax, "property"),
                Bucket = parameters && parameters.Bucket,
                Key = parameters && parameters.Key,
                rawData,
                promises,
                operation;

            if(Bucket && Key) {
                var params = {
                    Bucket: Bucket,
                    Key: Key
                   };

                /*
                    This params returns a data with these keys:
                    ["AcceptRanges","LastModified","ContentLength","ETag","ContentType","ServerSideEncryption","Metadata","Body"]
                */

                if (readExpressions) {
                    if(readExpressions.indexOf("signedUrl") !== -1) {
                        /*
                            Expires (Integer) — default: 900 — the number of seconds to expire the pre-signed URL operation in. Defaults to 15 minutes.
                        */

                        if(parameters.hasOwnProperty("expirationDelay")) {
                            var expirationDelay = Math.round(Number(parameters["expirationDelay"]));
                            if(Number.isNaN(expirationDelay)) {
                                console.error("Value for expirationDelay is not a number");
                            } else {
                                params["Expires"] = parameters["expirationDelay"]
                            }
                        }
                        (promises || (promises = [])).push(new Promise(function(resolve, reject) {
                            self._S3Client.getSignedUrl('getObject', params, function (err, url) {
                                if (err) {
                                    console.log(err, err.stack); // an error occurred
                                    (rawData || (rawData = {}))["signedUrl"] = err;
                                    reject(err);
                                }
                                else {
                                    //console.log('signedURL is', url);
                                    (rawData || (rawData = {}))["signedUrl"] = url;

                                    resolve(url);
                                }       // successful
                            });

                        }));
                    }

                    if((readExpressions.indexOf("key") !== -1) || (readExpressions.indexOf("bucketName") !== -1)) {
                        (rawData || (rawData = {}))["Bucket"] = Bucket;
                        (rawData || (rawData = {}))["Key"] = Key;
                    }

                }

            } else {
                console.log("Not sure what to send back, noOp?")
            }

            if(promises) {
                Promise.all(promises)
                .then(function(resolvedValue) {
                    operation = self.responseOperationForReadOperation(readOperation, null, [rawData], false/*isNotLast*/);
                    objectDescriptor.dispatchEvent(operation);
                }, function(error) {
                    operation = self.responseOperationForReadOperation(readOperation, error, null, false/*isNotLast*/);
                    objectDescriptor.dispatchEvent(operation);
                })
            } else {
                if(!rawData || (rawData && Object.keys(rawData).length === 0)) {
                    operation = new DataOperation();
                    operation.type = DataOperation.Type.NoOp;
                } else {
                    operation = self.responseOperationForReadOperation(readOperation, null /*no error*/, [rawData], false/*isNotLast*/);
                }
                objectDescriptor.dispatchEvent(operation);
            }
        }
    },

    handleObjectRead: {
        value: function (readOperation) {
            /*
                Until we solve more efficiently (lazily) how RawDataServices listen for and receive data operations, we have to check wether we're the one to deal with this:
            */
            if(!this.handlesType(readOperation.target)) {
                return;
            }

            //console.log("S3DataService - handleObjectRead");

            var data = readOperation.data,
                objectDescriptor = readOperation.target,
                mapping = objectDescriptor && this.mappingForType(objectDescriptor),
                primaryKeyPropertyDescriptors = mapping && mapping.primaryKeyPropertyDescriptors,

                criteria = readOperation.criteria,
                //We "know the pr
                readExpressions = readOperation.data.readExpressions,
                // iterator = new SyntaxInOrderIterator(criteria.syntax, "property"),
                Bucket = criteria.parameters && criteria.parameters.Bucket,
                Key = criteria.parameters && criteria.parameters.Key,
                params = {
                    Bucket: Bucket,
                    Key: Key
                },
                operation;



            if(Bucket && Key) {

                if (readExpressions) {
                        /*
                            This params returns a data with these keys:
                            ["AcceptRanges","LastModified","ContentLength","ETag","ContentType","ServerSideEncryption","Metadata","Body"]
                        */

                    this._S3Client.getObject(params, function(err, data) {
                        if (err) console.log(err, err.stack); // an error occurred
                        else     console.log(data);           // successful response
                        /*
                        data = {
                        AcceptRanges: "bytes",
                        ContentLength: 3191,
                        ContentType: "image/jpeg",
                        ETag: "\"6805f2cfc46c0f04559748bb039d69ae\"",
                        LastModified: <Date Representation>,
                        Metadata: {
                        },
                        TagCount: 2,
                        VersionId: "null"
                        }
                        */
                    });

                    /*
                        Expires (Integer) — default: 900 — the number of seconds to expire the pre-signed URL operation in. Defaults to 15 minutes.
                    */

                    var signedURL1
                    this._S3Client.getSignedUrl('getObject', params, function (err, url) {
                        if (err) {
                            console.log(err, err.stack); // an error occurred
                        }
                        else {
                            signedURL1 = url;
                            console.log('signedURL1 is', url);
                        }       // successful
                    });

                }

                operation = this.responseOperationForReadOperation(readOperation, null, [params], false/*isNotLast*/);

            } else {
                console.log("Not sure what to send back, noOp?");
                operation = this.responseOperationForReadOperation(readOperation, new Error("No values for Primary Keys 'Bucket' and 'Key'"), null, false/*isNotLast*/);
            }

            objectDescriptor.dispatchEvent(operation);

            // while ((currentSyntax = iterator.next("and").value)) {

        }
    },

    handleBucketRead: {
        value: function (readOperation) {
            /*
                Until we solve more efficiently (lazily) how RawDataServices listen for and receive data operations, we have to check wether we're the one to deal with this:
            */
            if(!this.handlesType(readOperation.target)) {
                return;
            }

            //console.log("S3DataService - handleObjectRead");

            var data = readOperation.data,
                objectDescriptor = readOperation.target,
                mapping = objectDescriptor && this.mappingForType(objectDescriptor),
                primaryKeyPropertyDescriptors = mapping && mapping.primaryKeyPropertyDescriptors,

                criteria = readOperation.criteria,
                //We "know the pr
                readExpressions = readOperation.data.readExpressions,
                // iterator = new SyntaxInOrderIterator(criteria.syntax, "property"),
                Bucket = criteria.parameters && criteria.parameters.Bucket,
                params = {
                    Bucket: Bucket
                },
                operation;



            if(Bucket) {

                if (readExpressions) {
                        /*
                            This params returns a data with these keys:
                            ["AcceptRanges","LastModified","ContentLength","ETag","ContentType","ServerSideEncryption","Metadata","Body"]
                        */

                    /*
                        Expires (Integer) — default: 900 — the number of seconds to expire the pre-signed URL operation in. Defaults to 15 minutes.
                    */

                }

                operation = this.responseOperationForReadOperation(readOperation, null, [params], false/*isNotLast*/);

            } else {
                console.log("Not sure what to send back, noOp?");
                operation = this.responseOperationForReadOperation(readOperation, new Error("No values for Primary Keys 'Bucket' and 'Key'"), null, false/*isNotLast*/);
            }

            objectDescriptor.dispatchEvent(operation);

            // while ((currentSyntax = iterator.next("and").value)) {

        }
    },

    handleRead: {
        value: function (readOperation) {

            /*
                Until we solve more efficiently (lazily) how RawDataServices listen for and receive data operations, we have to check wether we're the one to deal with this:
            */
           if(!this.handlesType(readOperation.target)) {
            return;
            }

            // console.log("S3DataService - handleRead");

            var data = readOperation.data,
                objectDescriptor = readOperation.target,
                readExpressions = readOperation.data.readExpressions;

            if (readExpressions) {


            }
        }
    }


    /*
        listBuckets(params = {}, callback) ⇒ AWS.Request
        https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listBuckets-property
    */

    /*
        listObjectsV2(params = {}, callback) ⇒ AWS.Request
        https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjectsV2-property


        listObjectVersions(params = {}, callback) ⇒ AWS.Request
        https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjectVersions-property
    */

    /*
        listMultipartUploads(params = {}, callback) ⇒ AWS.Request
        https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listMultipartUploads-property


        UploadPart type, MultipartUpload has a toMany to UploadPart
        listParts(params = {}, callback) ⇒ AWS.Request
        https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listParts-property
    */


});
