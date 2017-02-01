const gulp = require('gulp');
const htmlreplace = require('gulp-html-replace');
const runSequence = require('run-sequence');
const concat = require('gulp-concat');
const ngAnnotate = require('gulp-ng-annotate');
const uglify = require('gulp-uglify');
const rename = require('gulp-rename');
const clean = require('gulp-clean');
const cleanCss = require('gulp-clean-css');
const imagemin = require('gulp-imagemin');
const plumber = require('gulp-plumber');
const hash = require('gulp-hash');
const replace = require('gulp-replace');


let vendorPath = [
  "./src/vendor/pouchdb/dist/pouchdb.js",
  "./src/vendor/event-source-polyfill/eventsource.min.js",
  "./src/vendor/angular-cookies/angular-cookies.min.js",
  "./src/vendor/angular-ellipses/src/truncate.js",
  "./src/vendor/angular-timer/dist/angular-timer.min.js",
  "./src/vendor/angular-translate/angular-translate.min.js",
  "./src/vendor/angular-translate-storage-cookie/angular-translate-storage-cookie.min.js",
  "./src/vendor/angular-translate-storage-local/angular-translate-storage-local.min.js",
  "./src/vendor/angular-gtm-logger/angular-gtm-logger.min.js",
  "./src/vendor/moment/locale/ro.js",
  "./src/vendor/moment/locale/ru.js",
]

//watch
  gulp.task('watch:devel', () => gulp.watch('./**/src/**/*', ['build:devel']) );

// common
  gulp.task('clean', () =>
    gulp.src('./_attachments', {read: false})
      .pipe(clean())
  );

//devel

  gulp.task('build:devel',(callback) =>
    runSequence('clean','dev:cp',  callback)
  );

  gulp.task('dev:cp', () =>
    gulp.src(['src/**/*'])
      .pipe(gulp.dest('./_attachments/'))
  );

//production

  gulp.task('build:production', () =>
    runSequence('clean', ['replace:html', 'prepare:static',
      'minify:vendors', 'minify:js','minify:img','minify:main.css',
      'copy:other'], 'hash:production', () => {
        console.log("Configured production environment");
      })
  );


  gulp.task('replace:html', ['replace:esco', 'replace:tenders']);

  gulp.task('replace:esco', () =>
    gulp.src('src/esco/index.html')
      .pipe(plumber())
      .pipe(htmlreplace({
          'js': '../static/js/main.min.js',
          'vendor': '../vendor/vendor.min.js',
          'css': '../static/css/starter-template.min.css'
      }))
      .pipe(plumber.stop())
      .pipe(gulp.dest('_attachments/esco/'))
  );

  gulp.task('replace:tenders', () =>
    gulp.src('src/tenders/index.html')
      .pipe(plumber())
      .pipe(htmlreplace({
          'js': '../static/js/main.min.js',
          'vendor': '../vendor/vendor.min.js',
          'css': '../static/css/starter-template.min.css'
      }))
      .pipe(plumber.stop())
      .pipe(gulp.dest('_attachments/tenders/'))
  );

  gulp.task('hash:production', ['hash:esco', 'hash:tenders']);

  gulp.task('hash:esco', () => {
    let assets = require('./_attachments/assets.json')
    gulp.src('./_attachments/esco/index.html')
      .pipe(replace('main.min.js', assets['main.min.js']))
      .pipe(replace('starter-template.min.css', assets['starter-template.min.css']))
      .pipe(replace('vendor.min.js', assets['vendor.min.js']))
      .pipe(gulp.dest('_attachments/esco/'))
  });

  gulp.task('hash:tenders', () => {
    let assets = require('./_attachments/assets.json')
    gulp.src('./_attachments/tenders/index.html')
      .pipe(replace('main.min.js', assets['main.min.js']))
      .pipe(replace('starter-template.min.css', assets['starter-template.min.css']))
      .pipe(replace('vendor.min.js', assets['vendor.min.js']))
      .pipe(gulp.dest('_attachments/tenders'))
  });


  gulp.task('prepare:static', ['minify:js','minify:static/css',
    'minify:static/img','copy:fonts']);


  gulp.task('minify:js', () =>
    gulp.src(['src/static/js/escoModule.js', ,'src/static/js/app.js', 'src/static/js/*.js'])
      .pipe(plumber())
      .pipe(concat('main.min.js'))
      .pipe(ngAnnotate())
      .pipe(uglify())
      .pipe(hash())
      .pipe(gulp.dest('_attachments/static/js'))
      .pipe(hash.manifest('assets.json'))
      .pipe(gulp.dest('_attachments/'))
      .pipe(plumber.stop())
  );


  gulp.task('minify:static/css', () =>
    gulp.src('src/static/css/*.css')
      .pipe(plumber())
      .pipe(cleanCss({compatibility: 'ie8'}))
      .pipe(rename('starter-template.min.css'))
      .pipe(hash())
      .pipe(gulp.dest('./_attachments/static/css'))
      .pipe(hash.manifest('assets.json'))
      .pipe(gulp.dest('./_attachments/'))
      .pipe(plumber.stop())
  );


  gulp.task('minify:static/img', () =>
    gulp.src('src/static/img/*')
    .pipe(plumber())
    .pipe(imagemin())
    .pipe(plumber.stop())
    .pipe(gulp.dest('_attachments/static/img'))
  );


  gulp.task('copy:fonts', () =>
    gulp.src('src/static/fonts/*')
    .pipe(gulp.dest('_attachments/static/fonts'))
  );


  gulp.task('minify:main.css', () =>
    gulp.src('src/style/main.css')
    .pipe(plumber())
    .pipe(cleanCss({compatibility: 'ie8'}))
    .pipe(plumber.stop())
    .pipe(gulp.dest('_attachments/style/'))
  );


  gulp.task('minify:img', () =>
    gulp.src('src/*.png ')
      .pipe(plumber())
      .pipe(imagemin())
      .pipe(plumber.stop())
      .pipe(gulp.dest('_attachments/'))
  );


  gulp.task('minify:vendors', ['copy:customVendor'], () =>
    gulp.src(vendorPath)
      .pipe(concat('vendor.min.js'))
      .pipe(uglify())
      .pipe(hash())
      .pipe(gulp.dest('_attachments/vendor'))
      .pipe(hash.manifest('assets.json'))
      .pipe(gulp.dest('_attachments/'))
  );

  gulp.task('copy:customVendor', () =>
    gulp.src('./src/vendor/angular-growl-2/**/*')
      .pipe(gulp.dest('./_attachments/vendor/angular-growl-2'))
  )

  gulp.task('copy:other', () =>
    gulp.src(['src/*.xml','src/*.ico','src/*.json','src/get_current_server_time'])
      .pipe(gulp.dest('_attachments'))
  );
