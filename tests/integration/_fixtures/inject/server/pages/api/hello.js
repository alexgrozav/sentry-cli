"use strict";
(() => {
var exports = {};
exports.id = 453;
exports.ids = [453];
exports.modules = {

/***/ 8097:
/***/ ((module) => {

module.exports = require("@sentry/nextjs");

/***/ }),

/***/ 6738:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "config": () => (/* binding */ config),
/* harmony export */   "default": () => (/* binding */ apiWrapperTemplate)
/* harmony export */ });
/* harmony import */ var _sentry_nextjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(8097);
/* harmony import */ var _sentry_nextjs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_sentry_nextjs__WEBPACK_IMPORTED_MODULE_0__);


// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
function handler(req, res) {
    const grpc = __webpack_require__(8097);
    console.log(grpc);
    res.status(200).json({
        name: "John Doe"
    });
}

var origModule = /*#__PURE__*/Object.freeze({
    __proto__: null,
    'default': handler
});

/*
 * This file is a template for the code which will be substituted when our webpack loader handles API files in the
 * `pages/` directory.
 *
 * We use `__SENTRY_WRAPPING_TARGET_FILE__.cjs` as a placeholder for the path to the file being wrapped. Because it's not a real package,
 * this causes both TS and ESLint to complain, hence the pragma comments below.
 */

const userApiModule = origModule ;

// Default to undefined. It's possible for Next.js users to not define any exports/handlers in an API route. If that is
// the case Next.js wil crash during runtime but the Sentry SDK should definitely not crash so we need tohandle it.
let userProvidedHandler = undefined;

if ('default' in userApiModule && typeof userApiModule.default === 'function') {
  // Handle when user defines via ESM export: `export default myFunction;`
  userProvidedHandler = userApiModule.default;
} else if (typeof userApiModule === 'function') {
  // Handle when user defines via CJS export: "module.exports = myFunction;"
  userProvidedHandler = userApiModule;
}

const origConfig = userApiModule.config || {};

// Setting `externalResolver` to `true` prevents nextjs from throwing a warning in dev about API routes resolving
// without sending a response. It's a false positive (a response is sent, but only after we flush our send queue), and
// we throw a warning of our own to tell folks that, but it's better if we just don't have to deal with it in the first
// place.
const config = {
  ...origConfig,
  api: {
    ...origConfig.api,
    externalResolver: true,
  },
};

const apiWrapperTemplate = userProvidedHandler ? _sentry_nextjs__WEBPACK_IMPORTED_MODULE_0__.wrapApiHandlerWithSentry(userProvidedHandler, '/api/hello') : undefined;




/***/ }),

/***/ 2680:
/***/ ((__unused_webpack_module, __unused_webpack___webpack_exports__, __webpack_require__) => {

/* harmony import */ var _sentry_nextjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(8097);
/* harmony import */ var _sentry_nextjs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_sentry_nextjs__WEBPACK_IMPORTED_MODULE_0__);
var _sentryCollisionFreeGlobalObject = "undefined" === "undefined" ? global : window;
_sentryCollisionFreeGlobalObject["__sentryRewritesTunnelPath__"] = "/test";
_sentryCollisionFreeGlobalObject["SENTRY_RELEASE"] = {
    "id": "H7WYeNZ2HObPMd59_6n2m"
};
_sentryCollisionFreeGlobalObject["__rewriteFramesDistDir__"] = ".next";

_sentry_nextjs__WEBPACK_IMPORTED_MODULE_0__.init({
    dsn: "https://5ca6c435afc347aaa9a5e6fe9113c11f@o1163812.ingest.sentry.io/6762530",
    // We recommend adjusting this value in production, or using tracesSampler
    // for finer control
    tracesSampleRate: 1,
    // ...
    // Note: if you want to override the automatic release value, do not set a
    // `release` value here - use the environment variable `SENTRY_RELEASE`, so
    // that it will also get attached to your source maps
    debug: true,
    // release: "23.01.2023.6",
    environment: process.env.VERCEL ? "vercel" : "local",
    beforeSend: (event)=>{
        console.log(event);
        return event;
    }
});


/***/ })

};
;

// load runtime
var __webpack_require__ = require("../../webpack-api-runtime.js");
__webpack_require__.C(exports);
var __webpack_exec__ = (moduleId) => (__webpack_require__(__webpack_require__.s = moduleId))
var __webpack_exports__ = (__webpack_exec__(2680), __webpack_exec__(6738));
module.exports = __webpack_exports__;

})();
//# sourceMappingURL=hello.js.map