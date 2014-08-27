// Utility code for Faux Pas HTML reports.
//
// © 2014 Ali Rantakari
// http://fauxpasapp.com
//

'use strict';


// Utilities
//
Array.prototype.sorted_by_key = function(key, ascending) {
    var sort_ascending = (ascending === undefined) ? true : ascending;
    return this.sort(function(a,b) {
        var a_value = a[key];
        var b_value = b[key];
        if (a_value > b_value) return (sort_ascending ? 1 : -1);
        else if (a_value < b_value) return (sort_ascending ? -1 : 1);
        else return 0;
    });
};


// The app module + common stuff like config and filters
//
var App = angular.module('FauxPasReportApp', ['nvd3ChartDirectives']);

App.config(['$locationProvider', function($locationProvider){
    $locationProvider.html5Mode(true);    
}]);

App.filter('to_trusted', ['$sce', function($sce){
    return function(text) {
        return $sce.trustAsHtml(text);
    };
}]);

App.filter('basename', [function(){
    return function(path) {
        return !!path ? path.split('/').reverse()[0] : '';
    };
}]);



// Error reporting
//
App.factory('appErrors', function() {
    var errors = [];
    var listeners = [];
    var notifyListeners = function() {
        for (var i = 0; i < listeners.length; i++) {
            listeners[i](errors);
        }
    };
    return {
        errors: errors,
        addError: function(message) {
            errors.push(message);
            notifyListeners();
        },
        registerListener: function(listener) {
            listeners.push(listener);
        }
    };
});

App.controller('AppErrorsController', ['$scope', 'appErrors', function($scope, appErrors){
    $scope.errors = appErrors.errors;
    appErrors.registerListener(function(){ $scope.$apply(); });
}]);


// Loading of the diagnostics set JSON
//
App.factory('diagnosticsSetPromise', ['$location', '$http', 'appErrors', function($location, $http, appErrors) {
    var diags_set_file_path_arg = 'json';
    var diags_set_file_path = $location.search()[diags_set_file_path_arg];
    if (!diags_set_file_path)
    {
        appErrors.addError('Diagnostics JSON path not specified. Use the "'+diags_set_file_path_arg+'" query parameter.');
        return {success:function(){}};
    }

    return $http.get(diags_set_file_path)
                .error(function(data, status, headers, config) {
                    appErrors.addError('Could not load diagnostics JSON file "'+diags_set_file_path+'": '+
                                       'request status '+status+', response: '+data);
                });
}]);


// Main controller
//
App.controller('DiagnosticsSetController',
    ['$scope', 'diagnosticsSetPromise', function($scope, diagnosticsSetPromise){
    var get_property_color = function(prop_name, value) {
        if (/^severity/.test(prop_name)) {
            if (value == 'Error') return '#cb4b4b';
            else if (value == 'Warning') return '#cbbf4b';
            else if (value == 'Concern') return '#4ba3cb';
        } else if (/^impact/.test(prop_name)) {
            if (value == 'Style') return '#cb75b5';
            else if (value == 'Functionality') return '#7588cb';
            else if (value == 'Maintainability') return '#cb9c75';
        } else if (/^confidence/.test(prop_name)) {
            if (value == 'Absolute') return '#59cb56';
            else if (value == 'High') return '#8dcb56';
            else if (value == 'Medium') return '#b0cb56';
            else if (value == 'Low') return '#c8cb56';
        }
        return '#cbcbcb';
    };

    var grouped_diagnostics = function(diags, property_name) {
        var ret = {};
        for (var i = 0; i < diags.length; i++) {
            var diag = diags[i];
            var value = diag[property_name];
            if (!(value in ret))
                ret[value] = [];
            ret[value].push(diag);
        }
        return ret;
    };

    var counted_stats = function(diags, title, prop_name, numeric_prop_name) {
        var values = [];
        var diags_by_prop = grouped_diagnostics(diags, prop_name);
        for (var val in diags_by_prop) {
            var d = diags_by_prop[val];
            values.push({
                'name': val,
                'sort': (0 < d.length ? d[0][numeric_prop_name] : 0),
                'count': d.length,
                'percent': (d.length / diags.length) * 100,
                'color': (0 < d.length ? get_property_color(prop_name, d[0][prop_name]) : '#cbcbcb')
            });
        }
        return {
            'title': title,
            'values': values.sorted_by_key('sort', /*ascending=*/false),
            'total_count': diags.length,
        };
    };

    diagnosticsSetPromise.success(function(diagnostics_set, status, headers, config) {
        $scope.diags_set = diagnostics_set;

        $scope.chart_functions = {
            x: function(obj) { return obj.name; },
            y: function(obj) { return obj.count; },
            color: function(slice) { return slice.data.color; },
        };
        $scope.stats = {
            'counts': [
                counted_stats(diagnostics_set.diagnostics, 'Severity', 'severityDescription', 'severity'),
                counted_stats(diagnostics_set.diagnostics, 'Impact', 'impact', 'impact'),
                counted_stats(diagnostics_set.diagnostics, 'Confidence', 'confidenceDescription', 'confidence')
            ]
        };
    });
}]);

