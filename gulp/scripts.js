var gulp = require('gulp'),
    path = require('path'),
    concat = require('gulp-concat'),
    rename = require("gulp-rename"),
    sourcemaps = require('gulp-sourcemaps'),
    uglify = require('gulp-uglify'),
    jslint = require('gulp-jslint'),
    //merge2 = require('merge2'),
    //template = require('gulp-template-compile'),
    htmlmin = require('gulp-htmlmin');

exports.paths = [
  'bower_components/jquery/dist/jquery.js',
  'bower_components/bootstrap/dist/js/bootstrap.js'
];

/*gulp.task('jslint', function() {
 gulp.src(['pilote/src/js/*.js']).pipe(jslint({

            node: true,
            evil: true,
            nomen: true,
            reporter: 'default'
        }))
        .on('error', function (error) {
            console.error(String(error));
        });
});
*/

gulp.task('vendors', function() {
  gulp.src(exports.paths)
    .pipe(sourcemaps.init())
    .pipe(sourcemaps.write())
    .pipe(concat('vendor.js'))
    .pipe(gulp.dest('pilote/public/js'))
    .pipe(rename({suffix: '.min'}))
    .pipe(uglify())
    .pipe(gulp.dest('pilote/public/js'))
});

gulp.task('scripts', function() {
  gulp.src('pilote/src/js/**/*.js')
    .pipe(concat('main.js'))
    .pipe(gulp.dest('pilote/public/js'))
    .pipe(rename({suffix: '.min'}))
    .pipe(gulp.dest('pilote/public/js'))
/*    .pipe(uglify())
    .pipe(gulp.dest('pilote/public/js'))*/
});


