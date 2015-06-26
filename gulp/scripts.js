var gulp = require('gulp'),
    path = require('path'),
    concat = require('gulp-concat'),
    rename = require("gulp-rename"),
    sourcemaps = require('gulp-sourcemaps'),
    uglify = require('gulp-uglify'),
    //merge2 = require('merge2'),
    //template = require('gulp-template-compile'),
    htmlmin = require('gulp-htmlmin');

exports.paths = [
  'bower_components/jquery/dist/jquery.js',
  'bower_components/bootstrap/dist/js/bootstrap.js',
  'pilote/src/public/js/*.js'
];

gulp.task('scripts', function() {
  gulp.src(exports.paths)
    .pipe(sourcemaps.init())
    .pipe(sourcemaps.write())
    .pipe(concat('main.js'))
    .pipe(gulp.dest('pilote/public/js'))
    .pipe(rename({suffix: '.min'}))
    .pipe(uglify())
    .pipe(gulp.dest('pilote/public/js'))
});