var gulp = require('gulp'),
    path = require('path'),
    concat = require('gulp-concat'),
    rename = require("gulp-rename"),
    sourcemaps = require('gulp-sourcemaps'),
    uglify = require('gulp-uglify');

exports.paths = [
  'bower_components/jquery/dist/jquery.js',
  'bower_components/bootstrap/dist/js/bootstrap.js'
];

gulp.task('vendors', function() {
  gulp.src(exports.paths)
    .pipe(sourcemaps.init())
    .pipe(concat('vendor.js'))
    .pipe(gulp.dest('pilote/public/js'))
    .pipe(rename({suffix: '.min'}))
    .pipe(uglify())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('pilote/public/js'))
});

gulp.task('scripts', function() {
  gulp.src('pilote/src/js/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(concat('main.js'))
    .pipe(gulp.dest('pilote/public/js'))
    .pipe(rename({suffix: '.min'}))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('pilote/public/js'))
    .pipe(uglify())
    .pipe(gulp.dest('pilote/public/js'))
});


