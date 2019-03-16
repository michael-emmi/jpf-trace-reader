#!/usr/bin/env node

import * as assert from 'assert';
import * as Debug from 'debug';
import * as fs from 'fs';

import { Readable, PassThrough } from 'stream';
import { createInterface } from 'readline';

const debug = Debug('jpf-trace-reader ');

export function lines(input: Readable): AsyncIterable<string> {
  const output = new PassThrough({ objectMode: true });
  const readline = createInterface({ input });
  readline.on('line', line => output.write(line));
  readline.on('close', () => output.end());
  return output;
}

type Code = { file: string, line: string, method?: string, text: string };
type Transition = { thread: number, code: Code[] };
type Trace = { id: number, transitions: Transition[] };

async function * readTraces(stream: Readable): AsyncIterable<Trace> {
  const traces: Trace[] = [];
  let lastLineWasCode = false;

  for await (const line of lines(stream)) {
    debug(`%o`, line);

    const methodExpected = lastLineWasCode;
    lastLineWasCode = false;

    const traceLine = line.match(/^[=]+ trace #(\d+)$/);

    if (traceLine !== null) {
      const id = +traceLine[1];
      const transitions = [];
      debug(`new trace`);
      const trace = traces[traces.length-1];
      if (trace !== undefined)
        yield trace;
      traces.push({ id, transitions });
      continue;
    }

    const txLine = line.match(/^[-]+ transition #(\d+) thread: (\d+)$/);

    if (txLine !== null) {
      const thread = +txLine[2];
      const code = [];
      debug(`transition of thread %d`, thread);
      const trace = traces[traces.length-1];
      assert.ok(trace !== undefined);
      trace.transitions.push({ thread, code })
      continue;
    }

    const codeLine = line.match(/^  (\S+):(\d+) : (.*)$/);

    if (codeLine !== null) {
      const [ _, file, line, text ] = codeLine;
      const code = { file, line, text };
      debug(`code = %o`, code);
      const trace = traces[traces.length-1];
      assert.ok(trace !== undefined);
      const transition = trace.transitions[trace.transitions.length-1];
      assert.ok(transition !== undefined);
      transition.code.push(code);
      lastLineWasCode = true;
      continue;
    }

    const methodLine = line.match(/^    (\S+\(\S*\)\S+)$/);

    if (methodLine !== null ) {
      const method = methodLine[1];
      debug(`method = %o`, method);

      if (!methodExpected)
        continue;

      const trace = traces[traces.length-1];
      assert.ok(trace !== undefined);
      const transition = trace.transitions[trace.transitions.length-1];
      assert.ok(transition !== undefined);
      const code = transition.code[transition.code.length-1];
      if (code !== undefined && code.method === undefined)
        code.method = method;
      continue;
    }

    const resultsLine = line.match(/^[=]+ results$/);

    if (resultsLine !== null) {
      const trace = traces[traces.length-1];
      assert.ok(trace !== undefined);
      yield trace;
      continue
    }
  }
}

function compressTrace(trace: Trace): Trace {
  const { id } = trace;
  const transitions: Transition[] = [];

  for (const { thread, code } of trace.transitions) {
    let lastTx = transitions[transitions.length-1];
    if (lastTx === undefined || lastTx.thread !== thread)
      transitions.push(lastTx = { thread, code: [] });

    let lastCode = lastTx.code[lastTx.code.length-1];
    for (const { file, line, text, method: m } of code) {
      const method = m ? m.replace(/\(.*\).*$/, `(…)`) : lastCode.method;
      if (lastCode === undefined
          || lastCode.file !== file
          || lastCode.line !== line)
        lastTx.code.push(lastCode = { file, line, method, text });
    }
  }

  return { id, transitions };
}

function pad(string: string, width: number) {
  const n = (string.length + width) / 2;
  return string.padStart(n).padEnd(n);
}

function printTrace(trace: Trace): void {
  const { id, transitions } = trace;
  const width = 2 ** 6;

  console.log();
  console.log(`=`.repeat(width));
  console.log(pad(`Trace ${id}`, width));
  console.log(`=`.repeat(width));

  for (const { thread, code } of transitions) {
    let prevMethod = '';

    console.log();
    console.log(pad(`Thread ${thread}`, width));

    for (const { line, method, text } of code) {

      const methodName = method || 'uknown';
      if (methodName !== prevMethod) {
        if (prevMethod !== '')
          console.log();
        console.log(pad(`-`.repeat(methodName.length + 4), width));
        console.log(pad(`  ${methodName}  `, width));
        console.log(pad(`-`.repeat(methodName.length + 4), width));
        prevMethod = methodName;
      }

      console.log(`${line}:`.padEnd(6, ' '), text);

    }
    console.log();
    console.log(`-`.repeat(width));
  }
}

async function main(stream: Readable) {
  for await (const trace of readTraces(stream)) {
    debug(`trace = %o`, trace);
    const compressed = compressTrace(trace);
    debug(`compressed = %o`, compressed);
    printTrace(compressed);
  }
}

main(process.argv[2] ? fs.createReadStream(process.argv[2]) : process.stdin);
