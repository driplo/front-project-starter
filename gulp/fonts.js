var gulp = require('gulp');

exports.paths = ['pilote/src/fonts/*'];

gulp.task('fonts', function () {
  gulp.src(exports.paths)
    .pipe(gulp.dest('pilote/public/fonts'));
});
