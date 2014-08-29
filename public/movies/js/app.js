/*
    MediaCenterJS - A NodeJS based mediacenter solution

    Copyright (C) 2014 - Jan Smolders

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/
'use strict';

var movieApp = angular.module('movieApp', ['ui.bootstrap']);

movieApp.controller('movieCtrl', function($scope, $http, $modal) {
    $scope.focused = 0;
    $scope.serverMessage = 0;
    $scope.serverStatus= '';

    $http.get('/movies/load').success(function(data) {
        $scope.movies = data;
    });

    $scope.playMovie = function(data){
        $scope.playing = true;
        playMovie(data, $http);
    }

    $scope.open = function (movie) {
        var modalInstance = $modal.open({
            templateUrl: 'editModal.html',
            controller: ModalInstanceCtrl,
            size: 'md',
            resolve: {
                current: function () {
                    return movie;
                }
            }
        });
    }

    var ModalInstanceCtrl = function ($scope, $modalInstance, current) {
        $scope.original = angular.copy(current);
        $scope.current = current;

        $scope.cancel = function () {
            angular.copy($scope.original, $scope.current);
            $modalInstance.dismiss('cancel');
        };

        $scope.editItem = function(){
            $http({
                method: "post",
                data: {
                    newTitle            : $scope.current.title,
                    newPosterPath       : $scope.current.poster_path,
                    newBackdropPath     : $scope.current.backdrop_path,
                    hidden              : $scope.current.hidden.toString(),
                    currentMovie        : $scope.current.original_name
                },
                url: "/movies/edit"
            }).success(function(data, status, headers, config) {
                $modalInstance.dismiss();
            }).error(function() {
                $scope.errorMessage = "Unable to save changes. Check server is running and try again.";
            })
        };
        $scope.updateItem = function(){
            var title = $scope.current.title;
            $http({
                method: "post",
                data: {
                    newTitle            : title,
                    currentMovie        : $scope.current.original_name
                },
                url: "/movies/update"
            }).success(function(data, status, headers, config) {
                location.reload();
            }).error(function(data, status, headers, config) {
                $scope.errorMessage = "Couldn't find metadata for movie called " + title + " on TMDB";
            });
        };
    };


    function changeBackdrop(newsrc) {
        var elem = document.getElementById("backdropimg");
        elem.src = newsrc;
    }

    $scope.changeSelected = function(movie){
        var selectedMovie = $scope.filteredMovies.indexOf(movie);
        if ($scope.focused !== selectedMovie) {
            changeBackdrop(movie.backdrop_path);
            $scope.focused = selectedMovie;
        }
    }

    $scope.resetSelected = function () {
        $scope.focused = 0;
        setTimeout(function() {
            if ($scope.focused === 0) {
                changeBackdrop('/movies/css/img/backdrop.png');
            }
        }, 450);
    }

    var setupSocket = {
        async: function() {
            var promise = $http.get('/configuration/').then(function (response) {
                var configData  = response.data;
                var socket      = io.connect();
                socket.on('connect', function(data){
                    socket.emit('screen');
                });
                return {
                    on: function (eventName, callback) {
                        socket.on(eventName, function () {
                            var args = arguments;
                            $scope.$apply(function () {
                                callback.apply(socket, args);
                            });
                        });

                    },
                    emit: function (eventName, data, callback) {
                        socket.emit(eventName, data, function () {
                            var args = arguments;
                            $scope.$apply(function () {
                                if (callback) {
                                    callback.apply(socket, args);
                                }
                            });
                        });
                    }
                };
                return data;
            });
            return promise;
        }
    };

    setupSocket.async().then(function(data) {
        if (typeof data.on !== "undefined") {
            $scope.remote       = remote(data, $scope);
            $scope.keyevents    = keyevents(data, $scope);
        }
    });

});

function playMovie(data, $http){
    var orginalName = data;

    var platform = 'desktop';
    if (navigator.userAgent.match(/Android/i)) {
        platform = 'android';
    } else if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) {
        platform = 'ios';
    }

    $http.get('/movies/'+orginalName+'/play/'+platform).success(function(data) {
        var fileName                =   orginalName
            , outputFile            =   fileName.replace(/ /g, "-")
            , extentionlessFile     =   outputFile.replace(/\.[^\.]+$/, "")
            , videoUrl              =   "/data/movies/"+extentionlessFile+".mp4"
            , subtitleUrl           =   "/data/movies/"+extentionlessFile+".srt"
            , playerID              =   'player'
            , homeURL               =   '/movies/'
            , type                  =   'movies';
        videoJSHandler(playerID, data, videoUrl, subtitleUrl, orginalName,homeURL, 5000, type);
    });
}
