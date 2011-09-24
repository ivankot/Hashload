/*
 * Hashload
 * Version: 1.1.0
 * Description: allows to handle hash change events easily in different browsers
 * including FF 3.6+, Opara 10.6+, Chrome 6+, IE7+
 * 
 * Copyright (c) 2011 Ivan Kot <ivancat@gmail.com>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
(function(window) {
    if (!Array.prototype.indexOf) {
        Array.prototype.indexOf = function(object, startFrom) {
            for (var index = (startFrom || 0); index < this.length; index++) {
                if (this[index] === object) {
                    return index
                }
            }
            return -1;
        }
    }
    var EventManager = function() {}
    EventManager.prototype = {
        constructor: EventManager,
        addEvent: function(element, type, listener, useCapture) {
            useCapture = useCapture || false
            if (element.addEventListener) {
                element.addEventListener(type, listener, useCapture)
            } else if (element.attachEvent) {
                element.attachEvent("on" + type, listener)
            } else {
                element["on" + type] = listener
            }
        },
        removeEvent: function(element, type, listener, useCapture) {
            useCapture = useCapture || false
            if (element.removeEventListener) {
                element.removeEventListener(type, listener, useCapture)
            }
        },
        triggerEvent: function(type, target, bubbles, cancelable) {
            var event = this.createEvent(type, target, bubbles, cancelable)
            if (document.createEvent) {
                target.dispatchEvent(event)
            } else {
                var object = target.fireEvent ? target : document
                object.fireEvent(event.eventType, event)
            }
        },
        createEvent: function(type, target, bubbles, cancelable) {
            var event 
            target = target || window
            bubbles = bubbles || false
            cancelable = cancelable || false
            if (document.createEvent) {
                event = document.createEvent("HTMLEvents")
                event.initEvent(type, bubbles, cancelable)
                event.target = target
            } else {
                event = document.createEventObject()
                event.eventType = "on" + type
                event.target = target
            }
            return event
        }
    }
    var Rule = function(pattern, callback, url, method, params) {
        if (!pattern || (!pattern instanceof RegExp && typeof pattern != "string")) {
            throw new Error("Pattern has to be either a RegExp object or a string")
        }
        if (callback && typeof callback != "function") {
            throw new Error("Callback should be either null or function")
        }
        if (url && typeof url != "string") {
            throw new Error("URL parameter has to be a string")
        }
        if (url && typeof jQuery == "undefined") {
            console.log("there")
            throw new Error("Hashload currently requires jQuery to process AJAX calls")
        }
        if ((method && typeof method != "string") || (method && -1 == ["get", "post"].indexOf(method.toLowerCase()))) {
            throw new Error("Only the following methods are supported: get, post - and the method should be passed as a string")
        }
        if (params && typeof params != "object") {
            throw new Error("Params can either be null or an object")
        }
        this.pattern = typeof pattern == "string" ? new RegExp(pattern) : pattern;
        this.callback = callback || function() {}
        this.url = url
        this.method = method || "get"
        this.params = params || {}
        this.errorCallback = function() {
            window.location = this.url
            }
        this.completeCallback = function() {}
    }
    Rule.prototype = {
        constructor: Rule,
        match: function(event) {
            return this.pattern.test(event.hash)
        },
        makeCall: function(event) {
            if (this.url) {
                var self = this
                this.params = event.params ? event.params : this.params;
                jQuery.ajax({
                    url: this.url,
                    data: this.params,
                    success: function(data, textStatus, jqXHR) {
                        self.callback.apply(this, arguments)
                        },
                    error: function(jqXHR, textStatus, errorThrown) {
                        self.errorCallback.apply(this, arguments)
                        },
                    complete: function(jqXHR, textStatus) {
                        self.completeCallback.apply(this, arguments)
                        },
                    type: this.method
                })
            } else {
                this.callback(event)
            }
        },
        setErrorCallback: function(callback) {
            this._validateCallback(callback)
            this.errorCallback = callback
        },
        setCompleteCallback: function(callback) {
            this._validateCallback(callback)
            this.completeCallback = callback
        },
        _validateCallback: function(callback) {
            if (!callback || typeof callback != "function") {
                throw new Error("Callback has to be a function")
            }
        }
    }
    var Hashload = function() {
        this.callDefaultHandler = true
        this.skipDefaultHandler = false
        this.resetDefaultHandler()
        this.resetPreDispatchCallback()
        this.hash = null
        this._rules = []
        this._patterns = []
        this._eventManager = new EventManager();
    }
    Hashload.prototype = {
        constructor: Hashload,
        onHashChange: function(event) {
            event.hash = window.location.hash.substr(1); // remove the # sign
            var object = this.preDispatchCallback(event);
            if (this._supportsHashChange()) {
                for (var property in object) {
                    event[property] = object[property]
                }
            }
            this.dispatchEvent(event)
            this.processDefaultHandler(event)
        },
        run: function() {
            this.init()
        },
        init: function() {
            var self = this;
            if (this._supportsHashChange()) {
                this._eventManager.addEvent(window, 'hashchange', function(event) {self.onHashChange(self, event)});
            } else {
                this._legacyPoll()
            }
            if (window.location.hash) {
                this.triggerHashChange()
            }
        },
        dispatchEvent: function(event) {
            var index, length = this._rules.length
            for (index = 0; index < length; index++) {
                var rule = this._rules[index]
                if (rule && rule instanceof Rule && rule.match(event)) {
                    rule.makeCall(event)
                }
            }
        },
        addRule: function(pattern, callback, url, method, params) {
            this._rules.push(new Rule(pattern, callback, url, method, params))
            this._patterns.push(pattern)
        }, 
        removeRule: function(pattern) {
            this._validatePattern(pattern)
            pattern = typeof pattern == "string" ? new RegExp(pattern) : pattern
            var index = this._patterns.indexOf(pattern)
            while (-1 != index) {
                delete this._patterns[index]
                delete this._rules[index]
                index = this._patterns.indexOf(pattern)
            }
        },
        replaceRule: function(pattern, callback, url, method, params) {
            this._validatePattern(pattern)
            this._validateCallback(callback)
            pattern = typeof pattern == "string" ? new RegExp(pattern) : pattern
            var index, length = this._rules.length            
            for (index = 0; index < length; index++) {
                if (pattern == this._patterns[index]) {
                    this._rules[index] = new Rule(pattern, callback, url, method, params)
                }
            }
        },
        hasRule: function(pattern) {
            this._validatePattern(pattern)
            pattern = typeof pattern == "string" ? new RegExp(pattern) : pattern
            return -1 != this._patterns.indexOf(pattern)
        },
        setDefaultHandler: function(callback) {
            this.defaultHandler = function(event) {callback.call(this, event)}
        },
        resetDefaultHandler: function() {
            this.defaultHandler = function() {}
        },
        setCallDefaultHeader: function(value) {
            this.callDefaultHeader = value
        },
        skipDefaultHandler: function() {
            this.skipDefaultHandler = true
        },
        setPreDispatchCallback: function(callback) {
            this.preDispatchCallback = function(event) {return callback.call(this, event)}
        },
        resetPreDispatchCallback: function() {
            this.preDispatchCallback = function(event) {return event;}
        },
        processDefaultHandler: function(event) {
            if (this.callDefaultHandler && !this.skipDefaultHandler) {
                this.defaultHandler(event)
            }
            this.skipDefaultHandler = false
        },
        triggerHashChange: function() {
            if (this._supportsHashChange()) {
                this._eventManager.triggerEvent("hashchange", window)
            } else {
                this.onHashChange(this._eventManager.createEvent("hashchange", window))
            }
        },
        _validatePattern: function(pattern) {
            if (!pattern || (typeof pattern != "string" && !pattern instanceof RegExp)) {
                throw new Error("Pattern has to be either an instance of the RegExp object or a string")
            }
        },
        _validateCallback: function(callback) {
            if (callback && typeof callback != "function") {
                throw new Error("Callback cannot be null and has to be a function")
            }
        },
        _supportsHashChange: function() {
            return "onhashchange" in window && (document.documentMode === undefined || document.documentMode > 7);
        },
        _legacyPoll: function() {
            var self = this
            this.hash = window.location.hash
            window.setInterval(function() {
                if (self.hash != window.location.hash) {
                    self.hash = window.location.hash
                    self.triggerHashChange()
                }
            }, 300)
        }
    }
    window.hl = window.hashload = window.Hashload = new Hashload()
})(window);