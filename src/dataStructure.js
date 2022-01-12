'use strict';
(function (window) {
    function buildDataStructure() {
        var data = {},
            actualSetOperationCount = 0;

        function setData(obj) {
            actualSetOperationCount++;
            _.assign(data, obj);
        }

        return {
            getCounter: function () {
                return actualSetOperationCount;
            },
            setData: setData,
            _data: data
        };
    }

    window.buildDataStructure = buildDataStructure;

})(window);