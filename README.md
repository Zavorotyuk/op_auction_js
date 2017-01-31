## Environments

### Development
To build development version of application:
```
gulp build:devel
```
You can run watch task to rebuild application at every change of files in src directory
```
gulp watch:devel
```
### Production
To build productiom version of application:
```
gulp build:production
```

## CouchApp
1. ```git clone https://github.com/Zavorotyuk/op_auction_js.git```
2. Start couchdb
3. ``` cd op_auction_js```
4. ```gulp build:devel ``` or ```gulp build:production```
5. ```couchapp push http://localhost:5984/db_name ```
