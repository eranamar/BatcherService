describe("batcher test suit:", function () {

    var batcher, dataStructure;

    function setUpTest() {
        dataStructure = buildDataStructure();
        batcher = buildBatcher(dataStructure);
    }

    function generateDataSequence(length) {
        return _.range(length).map(function (i) {
            var obj = {};
            obj[i] = i;
            return obj;
        });
    }

    function assumeAmountOfRegisteredCallbacks(num) {
        var callbacks = _.range(num).map(function (i) {
            return jasmine.createSpy('callback_' + i);
        });
        callbacks.forEach(function (f) {
            batcher.uponCompletion(f);
        });
        return callbacks;
    }

    function setSequence(seq) {
        seq.forEach(function (dataToSet) {
            batcher.setData(dataToSet);
        });
    }

    function assumeNumOfRegisteredOperation(numOfOperations) {
        var dataObjectsArr = generateDataSequence(numOfOperations);
        setSequence(dataObjectsArr);
    }

    function expectCallbacksNotHaveBeenCalled(callbacks) {
        callbacks.forEach(function (f) {
            expect(f).not.toHaveBeenCalled();
        });
    }

    function expectToBeCalledOnce(callbacks) {
        expectNumOfCalls(callbacks, 1);
    }

    function expectNumOfCalls(callbacks, numOfCalls) {
        callbacks.forEach(function (f) {
            expect(f.calls.count()).toBe(numOfCalls);
        });
    }

    describe('flushing:', function () {

        beforeEach(setUpTest);

        it("should combine several operations to one setData invocation", function () {
            assumeNumOfRegisteredOperation(3);

            expect(dataStructure.getCounter()).toBe(0);
            batcher.flush();
            expect(dataStructure.getCounter()).toBe(1);
        });

        it("should return the number of operation flushed (test case 1)", function () {
            var operationCount = 5;
            assumeNumOfRegisteredOperation(operationCount);

            expect(batcher.flush()).toBe(operationCount);
        });

        it("should return the number of operation flushed (test case 2)", function () {
            setSequence([{'1a': 1, '1b': 2, '1c': 3, '1d': 4}, {'2a': 5}]);
            expect(batcher.flush()).toBe(2);
        });

        it("should merge the dataToSet into one object (on multiple keys remember only the last", function () {
            setSequence([{'multipleKey': 'firstValue'}, {'multipleKey': 'lastValue'}]);
            batcher.flush();
            expect(dataStructure._data).toEqual({'multipleKey': 'lastValue'});
        });

    });

    describe('UponCompletion:', function () {

        beforeEach(setUpTest);

        it("should call the callback after flushing", function () {
            var callbacks = assumeAmountOfRegisteredCallbacks(1);
            assumeNumOfRegisteredOperation(3);

            expectCallbacksNotHaveBeenCalled(callbacks);
            batcher.flush();
            expectToBeCalledOnce(callbacks);
        });

        it("should allowed multiple callbacks", function () {
            var callbacks = assumeAmountOfRegisteredCallbacks(2);
            assumeNumOfRegisteredOperation(3);

            expectCallbacksNotHaveBeenCalled(callbacks);
            batcher.flush();
            expectToBeCalledOnce(callbacks);
        });

        it("should not called the callbacks when nothing were flushed (even though flush() was called)", function () {
            var callbacks = assumeAmountOfRegisteredCallbacks(2);

            batcher.flush();
            expectCallbacksNotHaveBeenCalled(callbacks);
        });

    });

    describe('Async execution:', function () {

        beforeEach(setUpTest);

        function buildTimerMocks() {
            var pendingTimers = [], timersCancelled = [], timersResolved = [], lastTimer;
            var setTimeout = window.setTimeout.bind(window),
                clearTimeout = window.clearTimeout.bind(window);

            function setTimerMock(fn, interval) {
                var id = setTimeout(function wrapperForOriginal() {
                    _.pull(pendingTimers, id);
                    timersResolved.push(id);
                    fn();
                }, interval);
                pendingTimers.push(id);
                lastTimer = id;
                return id;
            }

            function clearTimerMock(id) {
                _.pull(pendingTimers, id);
                timersCancelled.push(id);
                return clearTimeout(id);
            }

            spyOn(window, 'setTimeout').and.callFake(setTimerMock);
            spyOn(window, 'clearTimeout').and.callFake(clearTimerMock);

            return {
                getPending: function () {
                    return pendingTimers;
                },
                getCancelled: function () {
                    return timersCancelled;
                },
                getResolved: function () {
                    return timersResolved;
                },
                getLastTimerId: function (){
                    return lastTimer;
                }
            };
        }

        it("for each setData should set a new timer and cancel the previous ones", function () {
            var timers = buildTimerMocks();
            assumeNumOfRegisteredOperation(4);
            var numOfCancelledTimers = _.size(timers.getCancelled());
            var numOfPendingTimers = _.size(timers.getPending());
            expect(numOfCancelledTimers).toBe(3);
            expect(numOfPendingTimers).toBe(1);
        });

        it("only the latest timer should be active after several calls to batcher.setData", function () {
            var timers = buildTimerMocks();
            assumeNumOfRegisteredOperation(5);
            expect(timers.getPending()).toContain(timers.getLastTimerId());
        });

        it("without flushing, the setData operation is asynchronous", function () {
            assumeNumOfRegisteredOperation(3);
            expect(dataStructure._data).toEqual({});
            expect(dataStructure.getCounter()).toBe(0);
        });

        it("setData should flush itself on the next tick", function (done) {
            assumeNumOfRegisteredOperation(3);

            expect(dataStructure.getCounter()).toBe(0);

            setTimeout(function () {
                expect(dataStructure.getCounter()).toBe(1);
                done();
            }, 200);
        });

        it("setData on different ticks should NOT be batched to one invocation", function (done) {
            assumeNumOfRegisteredOperation(3);

            setTimeout(function () {
                assumeNumOfRegisteredOperation(3);
            }, 0);

            setTimeout(function () {
                expect(dataStructure.getCounter()).toBe(2);
                done();
            }, 200);
        });

        it("calling flush() after self-flusing should have no effect (because there shouldn't be anything to flush)", function (done) {
            assumeNumOfRegisteredOperation(3);

            setTimeout(function () {
                var numOfFlushedOperation = batcher.flush();
                expect(dataStructure.getCounter()).toBe(1);
                expect(numOfFlushedOperation).toBe(0);
                done();
            }, 200);
        });

    });

});
