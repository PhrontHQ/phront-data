/**
    @module business-data.mod/data/main.mod/model/aws/secret
*/

var Target = require("mod/core/target").Target;

/**
 * @class Application
 * @extends Application
 *
 */

exports.UserPool = Target.specialize(/** @lends Application.prototype */ {

    name: {
        value: undefined
    },
    secret: {
        value: undefined
    },
    refreshTokenValidityValue: {
        value: undefined
    },
    accessTokenValidityValue: {
        value: undefined
    },
    idTokenValidityValue: {
        value: undefined
    },
    tokenValidityUnits: {
        value: undefined
    }
});
