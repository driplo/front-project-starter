var gulp = require('gulp');
var imagemin = require('gulp-imagemin');
var pngquant = require('imagemin-pngquant');

exports.paths = ['pilote/src/images/*'];

gulp.task('images', function () {
  gulp.src(exports.paths)
    .pipe(imagemin({
      progressive: true,
      svgoPlugins: [{removeViewBox: false}],
      use: [pngquant()]
    }))
    .pipe(gulp.dest('pilote/public/images'));
});