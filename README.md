# JPF Trace Reader

Converts [JPF] traces to something readable.

## Setup

Either install from [NPM]:

```
npm install -g jpf-trace-reader
```

or from a source distribution:

```
npm link
```

## Usage

Generate error trace(s) from [JPF], being sure to specify the `target` class, `classpath`, and `sourcepath` appropriately:

```
$ cat test.jpf
target = Test
classpath = .
sourcepath = .
report.console.property_violation = trace
report.console.show_method = true
report.console.show_code = true
search.multiple_errors = true

$ jpf test.jpf > trace.txt
```

Then run the reader:

```
$ jpf-trace-reader trace.txt

================================================================
                            Trace 1
================================================================

                            Thread 0
               ----------------------------------
                 Test.main(…)  
               ----------------------------------
42:    final ConcurrentHashMap obj = new ConcurrentHashMap();

------------------------------------------------------
  java.util.concurrent.ConcurrentHashMap.<clinit>(…)  
------------------------------------------------------
578:   private static int RESIZE_STAMP_BITS = 16;

<truncated>
```

Or just pipe [JPF]’s output to standard input:

```
$ jpf test.jpf | jpf-trace-reader
```


[JPF]: https://github.com/javapathfinder
[NPM]: https://www.npmjs.com
