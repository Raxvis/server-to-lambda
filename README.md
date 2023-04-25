# server-to-lambda
Run a local webserver to proxy requests to your lambda


## Getting started

If you have a lambda handler, you can run server-to-lambda like below
```bash
npx server-to-lambda src/index.handler -p=4000
```

This will spin up a local web service and allow you to pass HTTP requests to it like an ALB would