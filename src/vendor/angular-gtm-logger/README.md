Angular GTM Logger is a module which will decorate Angular's $log service, and provide a `GTMLogger` service which can be used to manually send messages of any kind to the GTM service.


### Getting Started

Once configured (by including "GTMLogger" as a module dependency), the `$log`
service will automatically be decorated, and all messages logged will be handled
as normal as well as formated and passed to GTMLogger.sendMessage.
The plain text messages are sent into the "json.message" field with the decorated log while custom JSON objects are sent via "json.messageObj" field.

To use both the decorated $log and the GTMLogger service, you must first
configure it with an inputToken, which is done via the GTMLoggerProvider:

```javascript
angular.module( 'myApp', ['GTMLogger'] )

  .run( function( GTMLogger, $log ) {

    //This will be sent to both the console and GTM
    $log.info( "I'm a little teapot." );

    //This will be sent to GTM only
    GTMLogger.sendMessage( 'Short and Stout.' )
  }

```

### $log decoration

When sent through the `$log` decorator, messages will be formatted as follows:

```javascript

// Example: $log.warn( 'Danger! Danger!' );
{
  level: "WARN",
  timestamp: "2014-05-01T13:10Z",
  msg: "Danger! Danger!"
}

// Example: $log.debug( 'User submitted something:', { foo: 'A.J', bar: 'Space' } )

{
  level: "DEBUG",
  timestamp: "2014-05-01T13:18Z",
  msg: ["User submitted something", { foo: 'A.J.', bar: 'Space' }]
}
```