var gulp = require('gulp');
var del = require('del');
var htmlreplace = require('gulp-html-replace');
var runSequence = require('run-sequence');
var concat = require('gulp-concat');
var ngAnnotate = require('gulp-ng-annotate');
var uglify = require('gulp-uglify');
var bytediff = require('gulp-bytediff');
var rename = require('gulp-rename');
var clean = require('gulp-clean');


//Clean ./_attachments folder

gulp.task('clean', function() {
  return gulp.src('./_attachments', {read: false})
  .pipe(clean());
})

//Copy all files from ./src to _attachments

gulp.task('dev:cp', function() {
       return gulp.src(['src/**/*'])
	    .pipe(gulp.dest('./_attachments/'))
});

//Copy all files from ./src to _attachments

gulp.task('build:devel', function(callback) {
   runSequence('clean', 'dev:cp', function() {
    console.log("Configured development environment");
  });
});

//Copy all files from ./src to _attachments

gulp.task('build:production', function() {
   runSequence('clean', 'minify:js','replace:html', function() {
    console.log('Configured production environment');
  })

});

//Change scripts in esco/index.html pages

gulp.task('replace:esco', function() {
  gulp.src('src/esco/index.html')
    .pipe(htmlreplace({
        'js': 'static/js/main.min.js',
        'vendors': 'static/vendors/main.min.js'
    }))
    .pipe(gulp.dest('_attachments/esco/'));
});

//Change scripts in tenders/index.html
gulp.task('replace:tenders', function() {
  gulp.src('src/tenders/index.html')
    .pipe(htmlreplace({
        'js': 'static/js/main.min.js',
        'vendors': 'static/vendors/main.min.js'
    }))
    .pipe(gulp.dest('_attachments/tenders/'));
});


// Replace html

gulp.task('replace:html', ['replace:esco', 'replace:tenders']);


//concat js

gulp.task('minify:js', function() {
    return gulp.src('src/static/js/*.js')
			.pipe(concat('main.js', {newLine: ';'}))
			.pipe(ngAnnotate({add: true}))
      .pipe(bytediff.start())
      	.pipe(uglify({mangle: true}))
      .pipe(bytediff.stop())
      .pipe(rename('main.min.js'))
      .pipe(gulp.dest('_attachments/static/js/'));
});
