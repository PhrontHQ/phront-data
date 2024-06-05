const UserIdentity = require("mod/data/model/app/user-identity").UserIdentity,
    Montage = require("mod/core/core").Montage;

/**
 * @class UserIdentity
 * @extends DataObject
 */

Montage.defineProperties(UserIdentity.prototype, {
    person: {value: undefined},
    images: {value: undefined},
    addresses: {value: undefined},
    
});