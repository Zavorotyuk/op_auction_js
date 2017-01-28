var gulp = require('gulp');
var del = require('del');
var htmlreplace = require('gulp-html-replace');

gulp.task('default', function() {
  gulp.src('src/esco/index.html')
    .pipe(htmlreplace({
        'js': 'js/bundle.min.js'
    }))
    .pipe(gulp.dest('_attachments/'));
});
////////////
//Clean ./_attachments folder
///////////

gulp.task('clean', function() {
  return del('_attachments/*')
})

///////////
//Copy all files from ./src to _attachments
//////////

gulp.task('dev:cp', function() {
       gulp.src(['src/**/*'])
	    .pipe(gulp.dest('_attachments'))
});

///////////
//Copy all files from ./src to _attachments
//////////

gulp.task('devel', function() {

});

///////////
//Copy all files from ./src to _attachments
//////////

gulp.task('production', function() {

});
