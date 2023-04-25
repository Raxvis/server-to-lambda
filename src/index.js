#!/usr/bin/env node

const path = require('path');
const { createServer } = require('http');

const defaultOptions = {
  port: 3000,
}

const optionsShorthand = {
  p: 'port'
}

const optionsFormatting = {
  port: parseInt,
}

const getOptionValue = (key, value) => {
  if (optionsFormatting[key]) {
    return optionsFormatting[key](value);
  }

  return value;
}

const getOptions = () =>  process.argv.slice(2).reduce((result, record) => {
    if (record.includes('=') &&  record.includes('--')) {
      const [key, value] = record.replace('--', '').split('=');

      return {...result, [key]: getOptionValue(key, value) };
    } else if (record.includes('=') &&  record.includes('-')) {
      const [key, value] = record.replace('-', '').split('=');

      if (optionsShorthand[key]) {
        return {...result, [optionsShorthand[key]]: getOptionValue(optionsShorthand[key], value)}
      }
    }

    return result
  }, defaultOptions);

const getHandler = () => {
  const [handler] = process.argv.slice(2);

  if (!handler) {
    throw new Error('Please pass in a handler path');
  }

  const sections = path.join(process.cwd(), handler).split('.');
  const handlerName = sections.pop();
  const handlerPath = sections.join('.');

  return { handlerPath, handlerName }
}

const streamToPromise = (stream) =>
  new Promise((resolve, reject) => {
    let body;

    stream.on('data', (chunk) => {
      body = body ? Buffer.concat([body, chunk]) : chunk;
    });
    stream.on('error', (error) => {
      reject(error);
    });
    stream.on('end', () => {
      resolve(body);
    });
  });

const requestToEvent = async (req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const body = await streamToPromise(req);

  const params = url.searchParams.entries();
  const queryStringParameters = {};

  for (const [name, value] of params) {
    queryStringParameters[name] = value;
  }

  return {
    body: body ? body.toString('utf8') : body,
    headers: { ...req.headers, Cookie: req.headers.cookie },
    httpMethod: req.method.toUpperCase(),
    isBase64Encoded: false,
    path: url.pathname,
    queryStringParameters,
    requestContext: { elb: { targetGroupArn: 'arn:aws:elasticloadbalancing:*' } },
  };
};

const app = async (req, res) => {
  try {
    const {handlerPath, handlerName} = getHandler();
    const handler = require(handlerPath)[handlerName];
    const newReq = await requestToEvent(req);
    const output = await handler(newReq, {});

    res.writeHead(output.statusCode, output.headers);

    if (output.isBase64Encoded) {
      res.end(Buffer.from(output.body, 'base64'));
    } else {
      res.end(output.body);
    }
  } catch (error) {
    console.log(error);
  }
};

const run = () => {
  const options = getOptions();

  createServer(app).listen(options.port, (error) => {
    if (error) {
      throw error;
    }
    console.log(`> Ready on http://localhost:${options.port}`);
  });
}

run();