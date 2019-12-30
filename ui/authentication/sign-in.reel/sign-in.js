var Component = require("montage/ui/component").Component,
    currentEnvironment = require("montage/core/environment").currentEnvironment,
    KeyComposer = require("montage/composer/key-composer").KeyComposer,
    DataOperation = require("montage/data/service/data-operation").DataOperation;


var SignIn = exports.SignIn = Component.specialize({

    _isFirstTransitionEnd: {
        value: true
    },

    username: {
        value: void 0
    },

    password: {
        value: void 0
    },

    isBrowserSupported: {
        get: function () {
            return currentEnvironment.browserName == 'chrome';
        }
    },

    signInButton: {
        value: void 0
    },

    passwordTextField: {
        value: void 0
    },

    usernameTextField: {
        value: void 0
    },

    hasError: {
        value: false
    },

    hadError: {
        value: false
    },

    _errorMessage: {
        value: null
    },

    errorMessage: {
        get: function () {
            return this._errorMessage;
        },
        set: function (errorMessage) {
            this._errorMessage = errorMessage;
            this.hasError = !!errorMessage;
        }
    },

    _isAuthenticating: {
        value: false
    },

    isAuthenticating: {
        set: function (isAuthenticating) {
            if (this._isAuthenticating !== isAuthenticating) {
                this._isAuthenticating = isAuthenticating;
                this._toggleUserInteraction();
            }
        },
        get: function () {
            return this._isAuthenticating;
        }
    },


    __keyComposer: {
        value: null
    },

    _keyComposer: {
        get: function () {
            if (!this.__keyComposer) {
                this.__keyComposer = new KeyComposer();
                this.__keyComposer.keys = "enter";
                this.__keyComposer.identifier = "enter";
                this.addComposerForElement(this.__keyComposer, this.element.ownerDocument.defaultView);
            }

            return this.__keyComposer;
        }
    },

    enterDocument: {
        value: function (isFirstTime) {

            //Check if the service has a knonw user:
            //TODO, we shouldn't be exposing a CognitoUser directly
            console.debug("FIX ME -> CognitoUser -> Phront User");
            // if(this.service.user) {
            //     this.username = this.service.user.getName();
            // }

            this.addEventListener("action", this, false);
            this._keyComposer.addEventListener("keyPress", this, false);
            this.element.addEventListener("transitionend", this, false);

            // checks for disconnected hash
            if(location.href.indexOf(";disconnected") > -1) {
                this.hasError = true;
                this.errorMessage = "Oops! Your token has expired. \n Please log back in.";
                location.href = location.href.replace(/;disconnected/g, '');
            }
            this.usernameTextField.focus();
        }
    },

    exitDocument: {
        value: function () {
            this.removeEventListener("action", this, false);
            this._keyComposer.removeEventListener("keyPress", this, false);
        }
    },


    handleKeyPress: {
        value: function (event) {
            if (event.identifier === "enter") {
                this.handleSignInAction();
            }
        }
    },

    handleSignInAction: {
        value: function() {
            var self = this,
                userIdentity = this.ownerComponent.userIdentity;
            if (this._isAuthenticating || !this.username) {
                return;
            }
            this.isAuthenticating = true;
            this.hadError = false;
            userIdentity.username = this.username;
            userIdentity.password = this.password;
            this.application.mainService.saveDataObject(userIdentity)
            .then(function () {
                self.isLoggedIn = true;
                // self.application.applicationModal.hide(self);

                // Don't keep any track of the credentials in memory.
                self.password = self.username = null;

                //FIXME: kind of hacky
                //self.application.dispatchEventNamed("userLogged");
            }, function (error) {
                if(error) {
                    if(error instanceof DataOperation && error.type === DataOperation.Type.UserAuthenticationFailed) {
                        self.hadError = true;
                        self.errorMessage = error.userMessage;
                    }

                    else if(error instanceof DataOperation && error.data.hasOwnProperty("accountConfirmationCode")) {
                        self.ownerComponent.needsAccountConfirmation = true;
                        self.hadError = true;

                    }
                    else if(error instanceof DataOperation && error.data.hasOwnProperty("password")) {
                        self.ownerComponent.needsChangePassword = true;
                    }
                    else {
                        self.errorMessage = error.message || error;
                        self.hadError = true;
                    }
                } else {
                    self.errorMessage = null;
                }
            }).finally(function (value) {
                if (self.errorMessage) {
                    self.element.addEventListener(
                        typeof WebKitAnimationEvent !== "undefined" ? "webkitAnimationEnd" : "animationend", self, false
                    );
                }

                self.isAuthenticating = false;
            });
        }
    },

    handleTransitionend: {
        value: function (e) {
            if(this.isLoggedIn && e.target == this.element && e.propertyName == 'opacity') {
                this.element.style.display = 'none';
            } else if (this._isFirstTransitionEnd) {
                this._isFirstTransitionEnd = false;
                this.usernameTextField.focus();
            }
        }
    },

    handleAnimationend: {
        value: function () {
            if (this.errorMessage) {
                this.passwordTextField.value = null;
                this.passwordTextField.element.focus();

                this.element.removeEventListener(
                    typeof WebKitAnimationEvent !== "undefined" ? "webkitAnimationEnd" : "animationend", this, false
                );
            }
        }
    },

    _toggleUserInteraction: {
        value: function () {
            this.signInButton.disabled = this._isAuthenticating;
            this.passwordTextField.disabled = this.usernameTextField.disabled = this._isAuthenticating;
        }
    }

});

SignIn.prototype.handleWebkitAnimationEnd = SignIn.prototype.handleAnimationend;
