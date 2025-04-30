"use strict";
exports.__esModule = true;
exports.WorkerPool = void 0;
/**
 * @author Deepkolos / https://github.com/deepkolos
 */
var WorkerPool = /** @class */ (function () {
    function WorkerPool(pool) {
        if (pool === void 0) { pool = 4; }
        this.pool = pool;
        this.queue = [];
        this.workers = [];
        this.workersResolve = [];
        this.workerStatus = 0;
    }
    WorkerPool.prototype._initWorker = function (workerId) {
        if (!this.workers[workerId]) {
            var worker = this.workerCreator();
            worker.addEventListener('message', this._onMessage.bind(this, workerId));
            this.workers[workerId] = worker;
        }
    };
    WorkerPool.prototype._getIdleWorker = function () {
        for (var i = 0; i < this.pool; i++)
            if (!(this.workerStatus & (1 << i)))
                return i;
        return -1;
    };
    WorkerPool.prototype._onMessage = function (workerId, msg) {
        var resolve = this.workersResolve[workerId];
        resolve && resolve(msg);
        if (this.queue.length) {
            var _a = this.queue.shift(), resolve_1 = _a.resolve, msg_1 = _a.msg, transfer = _a.transfer;
            this.workersResolve[workerId] = resolve_1;
            this.workers[workerId].postMessage(msg_1, transfer);
        }
        else {
            this.workerStatus ^= 1 << workerId;
        }
    };
    WorkerPool.prototype.setWorkerCreator = function (workerCreator) {
        this.workerCreator = workerCreator;
    };
    WorkerPool.prototype.setWorkerLimit = function (pool) {
        this.pool = pool;
    };
    WorkerPool.prototype.postMessage = function (msg, transfer) {
        var _this = this;
        return new Promise(function (resolve) {
            var workerId = _this._getIdleWorker();
            if (workerId !== -1) {
                _this._initWorker(workerId);
                _this.workerStatus |= 1 << workerId;
                _this.workersResolve[workerId] = resolve;
                _this.workers[workerId].postMessage(msg, transfer);
            }
            else {
                _this.queue.push({ resolve: resolve, msg: msg, transfer: transfer });
            }
        });
    };
    WorkerPool.prototype.destroy = function () {
        this.workers.forEach(function (worker) { return worker.terminate(); });
        this.workersResolve.length = 0;
        this.workers.length = 0;
        this.queue.length = 0;
        this.workerStatus = 0;
    };
    return WorkerPool;
}());
exports.WorkerPool = WorkerPool;
