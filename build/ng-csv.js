(function(window, document) {

// Create all modules and define dependencies to make sure they exist
// and are loaded in the correct order to satisfy dependency injection
// before all nested files are concatenated by Grunt

// Config
angular
    .module('ngCsv.config', [])
    .value('ngCsv.config', { debug: true })
    .config(['$compileProvider', function ($compileProvider) {
        if (angular.isDefined($compileProvider.urlSanitizationWhitelist)) {
            $compileProvider.urlSanitizationWhitelist(/^\s*(https?|ftp|mailto|file|data):/);
        } else {
            $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|file|data):/);
        }
    }]);

// Modules
angular.module('ngCsv.directives', ['ngCsv.services']);
angular.module('ngCsv.services', []);
angular.module('ngCsv',
    [
    'ngCsv.config',
    'ngCsv.services',
    'ngCsv.directives',
    'ngSanitize'
]);

// Common.js package manager support (e.g. ComponentJS, WebPack)
if (typeof module !== 'undefined' && typeof exports !== 'undefined' && module.exports === exports) {
    module.exports = 'ngCsv';
}
/**
 * Created by asafdav on 15/05/14.
 */
angular.module('ngCsv.services').
  service('CSV', ['$q', function ($q) {
        
        var EOL = '\r\n';
        
        var specialChars = {
            '\\t': '\t',
            '\\b': '\b',
            '\\v': '\v',
            '\\f': '\f',
            '\\r': '\r'
        };
        
        /**
     * Stringify one field
     * @param data
     * @param options
     * @returns {*}
     */
    this.stringifyField = function (data, options) {
            if (options.decimalSep === 'locale' && this.isFloat(data)) {
                return data.toLocaleString();
            }
            
            if (options.decimalSep !== '.' && this.isFloat(data)) {
                return data.toString().replace('.', options.decimalSep);
            }
            
            if (typeof data === 'string') {
                data = data.replace(options.txtDelim, options.txtDelim + options.txtDelim); // Escape txtDelimiter
                
                if (options.quoteStrings || data.indexOf(options.fieldSep) > -1 || data.indexOf('\n') > -1 || data.indexOf('\r') > -1) {
                    data = options.txtDelim + data + options.txtDelim;
                }
                
                return data;
            }
            
            if (typeof data === 'boolean') {
                return data ? 'TRUE' : 'FALSE';
            }
            
            return data;
        };
        
        /**
     * Helper function to check if input is float
     * @param input
     * @returns {boolean}
     */
    this.isFloat = function (input) {
            return +input === input && (!isFinite(input) || Boolean(input % 1));
        };
        
        /**
     * Creates a csv from a data array
     * @param data
     * @param options
     *  * header - Provide the first row (optional)
     *  * fieldSep - Field separator, default: ',',
     *  * addByteOrderMarker - Add Byte order mark, default(false)
     * @param callback
     */
    this.stringify = function (data, options) {
            var def = $q.defer();
            
            var that = this;
            var csv = "";
            var csvContent = "";
            
            var dataPromise = $q.when(data).then(function (responseData) {
                
                // Check if there's a provided header array
                if (angular.isDefined(options.header) && options.header) {
                    var encodingArray, headerString;
                    
                    encodingArray = [];
                    angular.forEach(options.header, function (title, key) {
                        this.push(that.stringifyField(title, options));
                    }, encodingArray);
                    
                    headerString = encodingArray.join(options.fieldSep ? options.fieldSep : ",");
                    csvContent += headerString + EOL;
                }
                
                var arrData = [];
                
                if (angular.isArray(responseData)) {
                    arrData = responseData;
                }
                else if (angular.isFunction(responseData)) {
                    arrData = responseData();
                }
                
                // Check if using keys as labels
                if (angular.isDefined(options.label) && options.label && typeof options.label === 'boolean') {
                    var labelArray, labelString;
                    
                    labelArray = [];
                    angular.forEach(arrData[0], function (value, label) {
                        this.push(that.stringifyField(label, options));
                    }, labelArray);
                    labelString = labelArray.join(options.fieldSep ? options.fieldSep : ",");
                    csvContent += labelString + EOL;
                }
                
                angular.forEach(arrData, function (oldRow, index) {
                    var row = angular.copy(arrData[index]);
                    var dataString, infoArray;
                    
                    infoArray = [];
                    
                    var iterator = !!options.columnOrder ? options.columnOrder : row;
                    angular.forEach(iterator, function (field, key) {
                        var val = !!options.columnOrder ? row[field] : field;
                        this.push(that.stringifyField(val, options));
                    }, infoArray);
                    
                    dataString = infoArray.join(options.fieldSep ? options.fieldSep : ",");
                    csvContent += index < arrData.length ? dataString + EOL : dataString;
                });
                
                //deal with the character set
                options.charset = options.charset || "utf-8";
                options.charset = options.charset.toLowerCase();
                if (options.charset === "utf-16") {
                    csv = that.utf16Encode(csvContent, options.addByteOrderMarker);
                } else if (options.charset === "utf-16le") {
                    csv = that.utf16leEncode(csvContent, options.addByteOrderMarker);
                } else if (options.charset === "utf-16be") {
                    csv = that.utf16beEncode(csvContent, options.addByteOrderMarker);
                } else {
                    csv = that.utf8Encode(csvContent, options.addByteOrderMarker);
                }
                
                //resolve
                def.resolve(csv);
            });
            
            if (typeof dataPromise['catch'] === 'function') {
                dataPromise['catch'](function (err) {
                    def.reject(err);
                });
            }
            
            return def.promise;
        };
        
        /**
     * Helper function to check if input is really a special character
     * @param input
     * @returns {boolean}
     */
    this.isSpecialChar = function (input) {
            return specialChars[input] !== undefined;
        };
        
        /**
     * Helper function to get what the special character was supposed to be
     * since Angular escapes the first backslash
     * @param input
     * @returns {special character string}
     */
    this.getSpecialChar = function (input) {
            return specialChars[input];
        };
        
        /**
     * Helper function to encode the content as a utf-16 byte array
     * @param content
     * @param addBOM
     * @returns {utf-16 encoded byte array}
     */
    this.utf16Encode = function (content, addBOM) {
            var bytes = [];
            if (addBOM) {
                bytes.push(0xfe, 0xff);  //Big Endian Byte Order Marks
            }
            
            for (var i = 0; i < content.length; i++) {
                var charCode = content.charCodeAt(i);
                bytes.push((charCode & 0xff00) >>> 8);  //high byte
                bytes.push(charCode & 0xff);  //low byte
            }
            
            return new Uint8Array(bytes);
        };
        
        /**
     * Helper function to encode the content as a utf-16be byte array
     * @param content
     * @param addBOM
     * @returns {utf-16be encoded byte array}
     */   
    this.utf16beEncode = function (content, addBOM) {
            return this.utf16Encode(content, addBOM);
        };
        
        /**
     * Helper function to encode the content as a utf-16le byte array
     * @param content
     * @param addBOM
     * @returns {utf-16le encoded byte array}
     */
    this.utf16leEncode = function (content, addBOM) {
            var bytes = [];
            if (addBOM) {
                bytes.push(0xff, 0xfe);  //Little Endian Byte Order Marks
            }
            
            for (var i = 0; i < content.length; i++) {
                var charCode = content.charCodeAt(i);
                bytes.push(charCode & 0xff);  //low byte
                bytes.push((charCode & 0xff00) >>> 0x8);  //high byte
            }
            
            return new Uint8Array(bytes);
        };
        
        /**
     * Helper function to encode the content as a utf-8 byte array
     * @param content
     * @param addBOM
     * @returns {utf-8 encoded byte array}
     */
    this.utf8Encode = function (content, addBOM) {
            var bytes = [];
            if (addBOM) {
                bytes.push(0xef, 0xbb, 0xbf);
            }
            
            for (var i = 0; i < content.length; i++) {
                var charCode = content.charCodeAt(i);
                
                if (charCode < 0x80) {
                    bytes.push(charCode);
                } else if ((charCode > 0x7f) && (charCode < 0x800)) {
                    bytes.push((charCode >> 0x6) | 0xc0);
                    bytes.push((charCode & 0x3f) | 0x80);
                } else {
                    bytes.push((charCode >> 0xc) | 0xe0);
                    bytes.push(((charCode >> 0x6) & 0x3f) | 0x80);
                    bytes.push((charCode & 0x3f) | 0x80);
                }
            }
            
            return new Uint8Array(bytes);
        };
    }]);
/**
 * ng-csv module
 * Export Javascript's arrays to csv files from the browser
 *
 * Author: asafdav - https://github.com/asafdav
 */
angular.module('ngCsv.directives').
  directive('ngCsv', ['$parse', '$q', 'CSV', '$document', '$timeout', function ($parse, $q, CSV, $document, $timeout) {
        return {
            restrict: 'AC',
            scope: {
                data: '&ngCsv',
                filename: '@filename',
                header: '&csvHeader',
                columnOrder: '&csvColumnOrder',
                txtDelim: '@textDelimiter',
                decimalSep: '@decimalSeparator',
                quoteStrings: '@quoteStrings',
                fieldSep: '@fieldSeparator',
                lazyLoad: '@lazyLoad',
                addByteOrderMarker: "@addBom",
                ngClick: '&',
                charset: '@charset',
                label: '&csvLabel'
            },
            controller: [
                '$scope',
                '$element',
                '$attrs',
                '$transclude',
                function ($scope, $element, $attrs, $transclude) {
                    $scope.csv = '';
                    
                    if (!angular.isDefined($scope.lazyLoad) || $scope.lazyLoad != "true") {
                        if (angular.isArray($scope.data)) {
                            $scope.$watch("data", function (newValue) {
                                $scope.buildCSV();
                            }, true);
                        }
                    }
                    
                    $scope.getFilename = function () {
                        return $scope.filename || 'download.csv';
                    };
                    
                    function getBuildCsvOptions() {
                        var options = {
                            txtDelim: $scope.txtDelim ? $scope.txtDelim : '"',
                            decimalSep: $scope.decimalSep ? $scope.decimalSep : '.',
                            quoteStrings: $scope.quoteStrings,
                            addByteOrderMarker: $scope.addByteOrderMarker,
                            charset: $scope.charset
                        };
                        if (angular.isDefined($attrs.csvHeader)) options.header = $scope.$eval($scope.header);
                        if (angular.isDefined($attrs.csvColumnOrder)) options.columnOrder = $scope.$eval($scope.columnOrder);
                        if (angular.isDefined($attrs.csvLabel)) options.label = $scope.$eval($scope.label);
                        options.fieldSep = $scope.fieldSep ? $scope.fieldSep : ",";
                        
                        // Replaces any badly formatted special character string with correct special character
                        options.fieldSep = CSV.isSpecialChar(options.fieldSep) ? CSV.getSpecialChar(options.fieldSep) : options.fieldSep;
                        
                        return options;
                    }
                    
                    /**
           * Creates the CSV and updates the scope
           * @returns {*}
           */
          $scope.buildCSV = function () {
                        var deferred = $q.defer();
                        
                        $element.addClass($attrs.ngCsvLoadingClass || 'ng-csv-loading');
                        
                        CSV.stringify($scope.data(), getBuildCsvOptions()).then(function (csv) {
                            $scope.csv = csv;
                            $element.removeClass($attrs.ngCsvLoadingClass || 'ng-csv-loading');
                            deferred.resolve(csv);
                        });
                        $scope.$apply(); // Old angular support
                        
                        return deferred.promise;
                    };
                }
            ],
            link: function (scope, element, attrs) {
                function doClick() {
                    var charset = scope.charset || "utf-8";
                    var blob = new Blob([scope.csv], {
                        type: "text/csv;charset=" + charset + ";"
                    });
                    
                    if (window.navigator.msSaveOrOpenBlob) {
                        navigator.msSaveBlob(blob, scope.getFilename());
                    } else {
                        
                        var downloadContainer = angular.element('<div data-tap-disabled="true"><a></a></div>');
                        var downloadLink = angular.element(downloadContainer.children()[0]);
                        downloadLink.attr('href', window.URL.createObjectURL(blob));
                        downloadLink.attr('download', scope.getFilename());
                        downloadLink.attr('target', '_blank');
                        
                        $document.find('body').append(downloadContainer);
                        $timeout(function () {
                            downloadLink[0].click();
                            downloadLink.remove();
                        }, null);
                    }
                }
                
                element.bind('click', function (e) {
                    scope.buildCSV().then(function (csv) {
                        doClick();
                    });
                    scope.$apply();
                });
            }
        };
    }]);
})(window, document);