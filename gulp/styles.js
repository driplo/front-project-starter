var gulp = require('gulp'),
    less = require('gulp-less'),
    autoprefixer = require('gulp-autoprefixer'),
    path = require('path'),
    concat = require('gulp-concat'),
    rename = require("gulp-rename"),
    cssmin = require('gulp-cssmin'),
    sourcemaps = require('gulp-sourcemaps'),
    notify = require("gulp-notify"),
    util = require("gulp-util");

exports.paths = [
  'bower_components/normalize.css/normalize.css',
  'bower_components/bootstrap/dist/css/bootstrap.css',
  'bower_components/fontawesome/css/font-awesome.min.css',
  'bower_components/animsition/dist/css/animsition.min.css',
  'bower_components/animate.css/animate.min.css',
  'pilote/src/less/main.less'
];

gulp.task('styles', function () {
  gulp.src(exports.paths)
    .pipe(sourcemaps.init())
    .pipe(less({paths: [ path.join(__dirname, 'less', 'includes') ]}))
    .on('error', notify.onError({ message: util.log.message}))
    .pipe(autoprefixer())
    .pipe(concat('app.css'))
    .pipe(gulp.dest('pilote/public/css'))
    .pipe(cssmin())
    .pipe(rename({suffix: '.min'}))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('pilote/public/css'))
    .pipe(notify('Style Done'))
});
