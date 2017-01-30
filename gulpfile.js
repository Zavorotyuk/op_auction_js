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
var cleanCss = require('gulp-clean-css');
var imagemin = require('gulp-imagemin');
var plumber = require('gulp-plumber');



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
   runSequence('clean', ['concat:js','replace:html', 'minify:css', 'copy:vendors'], function() {
    console.log('Configured production environment');
  })

});

//Change scripts in esco/index.html pages

gulp.task('replace:esco', function() {
  gulp.src('src/esco/index.html')
    .pipe(htmlreplace({
        // 'js': '../static/js/main.min.js',
        // 'vendors': '../vendors/main.min.js',
        'css': '../static/css/starter-template.min.css'
    }))
    .pipe(gulp.dest('_attachments/esco/'));
});

//Change scripts in tenders/index.html
gulp.task('replace:tenders', function() {
  gulp.src('src/tenders/index.html')
    .pipe(htmlreplace({
        'js': '../static/js/main.min.js',
        // 'vendors': '../vendors/main.min.js',
        'css': '../static/css/starter-template.min.css'
    }))
    .pipe(gulp.dest('_attachments/tenders/'));
});


// Replace html

gulp.task('replace:html', ['replace:esco', 'replace:tenders']);


//concat and minify js

gulp.task('concat:js', function() {
    return gulp.src(['src/static/js/*.js'])
	    // .pipe(plumber())
			// .pipe(concat('main.min.js'))
      // .pipe(plumber.stop())
      .pipe(gulp.dest('_attachments/static/js'))

});
//
// gulp.task('minify:js', function() {
//     return gulp.src('src/static/js/*.js')
// 			.pipe(concat('main.js', {newLine: ';'}))
// 			.pipe(ngAnnotate({add: true}))
//       .pipe(rename('main.min.js'))
//       .pipe(gulp.dest('_attachments/static/js/'));
// });
//

gulp.task('minify:vendors', function() {

})


gulp.task('minify:css', function() {
  return gulp.src('src/static/css/*.css')
    .pipe(cleanCss({compatibility: 'ie8'}))
    .pipe(rename('starter-template.min.css'))
    .pipe(gulp.dest('_attachments/static/css'));
});

gulp.task('minify:img', () =>
    gulp.src('src/img/*')
        .pipe(imagemin())
        .pipe(gulp.dest('_attachments/images'))
      );

gulp.task('copy:vendors', function() {
  gulp.src('src/vendor/**/*')
  .pipe(gulp.dest('_attachments/vendor'))
})
