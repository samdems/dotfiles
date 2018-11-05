'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var Log;
(function (Log) {
    function error(msg) {
        if (Log.writer && msg) {
            Log.writer.error(msg);
        }
    }
    Log.error = error;
    function warn(msg) {
        if (Log.writer && msg) {
            Log.writer.warn(msg);
        }
    }
    Log.warn = warn;
    function info(msg) {
        if (Log.writer && msg) {
            Log.writer.info(msg);
        }
    }
    Log.info = info;
})(Log = exports.Log || (exports.Log = {}));
